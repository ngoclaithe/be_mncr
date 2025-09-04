const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Stream } = require('../../models');

class StreamHandler {
    constructor(webSocketService) {
        this.wsService = webSocketService;
        this.io = webSocketService.io;
        this.rooms = webSocketService.rooms;
        this.userSessions = webSocketService.userSessions;
        
        this.ffmpegProcesses = new Map();
        this.chunkBuffers = new Map();
        this.streamStats = new Map();
        
        this.inputBuffers = new Map();
        this.bufferThresholds = new Map();
        this.processingQueues = new Map();
        
        this.mp4Headers = new Map(); 
        this.mp4Initialized = new Map(); 
        this.fragmentBuffers = new Map(); 
    }

    setupHandlers(socket) {
        socket.on('join_room_stream', (data) => {
            this.handleJoinRoom(socket, data);
        });

        socket.on('leave_room_stream', (data) => {
            this.handleLeaveRoom(socket, data?.roomId);
        });

        socket.on('stream_chunk', (data) => {
            this.handleStreamChunk(socket, data);
        });

        socket.on('mp4_init_segment', (data) => {
            this.handleMP4InitSegment(socket, data);
        });

        socket.on('request_stream_stats', (data) => {
            this.handleStreamStats(socket, data.roomId);
        });
    }

    handleJoinRoom(socket, data) {
        try {
            console.log(`123 Socket ${socket.id} joining stream room with data:`, data);
            const { roomId, userId, username, userType } = data;

            if (!roomId) {
                socket.emit('error', { message: 'Room ID is required' });
                return;
            }

            const userSession = this.userSessions.get(socket.id);
            if (userSession) {
                userSession.currentRoom = roomId;
                userSession.clientType = userType || 'viewer';
                userSession.lastActive = new Date();
                userSession.userId = userId;
                userSession.username = username;
            }

            socket.join(`stream_${roomId}`);

            if (!this.rooms.has(roomId)) {
                this.rooms.set(roomId, {
                    roomId,
                    clients: new Set(),
                    createdAt: new Date(),
                    lastActivity: Date.now(),
                    streamStarted: false
                });
            }

            const room = this.rooms.get(roomId);
            room.clients.add(socket.id);
            room.lastActivity = Date.now();

            socket.to(`stream_${roomId}`).emit('user_joined', {
                userId,
                username,
                userType,
                timestamp: Date.now()
            });

            socket.emit('room_joined', {
                roomId,
                viewerCount: room.clients.size,
                timestamp: Date.now(),
                streamStarted: room.streamStarted
            });

            this.io.to(`stream_${roomId}`).emit('viewer_count_updated', {
                count: room.clients.size
            });

            console.log(`User ${username || 'Anonymous'} joined stream room ${roomId}`);
        } catch (error) {
            // console.error(`Error handling join_room_stream:`, error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    }

    handleMP4InitSegment(socket, data) {
        const { roomId, initData } = data;
        
        if (!roomId || !initData) {
            // console.log(`Invalid MP4 init segment data from socket ${socket.id}`);
            return;
        }

        //// console.log(`Received MP4 init segment for room ${roomId}, size: ${initData.byteLength || initData.length} bytes`);

        let buffer;
        if (initData instanceof ArrayBuffer) {
            buffer = Buffer.from(initData);
        } else if (Buffer.isBuffer(initData)) {
            buffer = initData;
        } else {
            // console.error(`Invalid init segment format for room ${roomId}`);
            return;
        }

        this.mp4Headers.set(roomId, buffer);
        this.mp4Initialized.set(roomId, false);
        
        //// console.log(`Stored MP4 initialization segment for room ${roomId}`);
        
        this.initializeRoomBuffers(roomId);
    }

    handleStreamChunk(socket, data) {
        const { streamId, streamKey: roomId, chunkData: chunk, chunkNumber, mimeType } = data;
        
        if (!roomId || !chunk) {
            // console.log(`❌ Invalid stream_chunk data from socket ${socket.id}`);
            return;
        }

        // console.log(`📦 Received MP4 chunk #${chunkNumber} for room ${roomId}, size: ${chunk.byteLength || chunk.length} bytes`);

        if (!this.mp4Headers.has(roomId)) {
            // console.warn(`⚠️ No MP4 init segment for room ${roomId} yet - buffering chunk ${chunkNumber}`);
        }

        // Initialize buffers and stats if not exists
        this.initializeRoomBuffers(roomId);

        const stats = this.streamStats.get(roomId);
        stats.totalChunks++;
        stats.totalBytes += chunk.byteLength || chunk.length;
        stats.averageChunkSize = stats.totalBytes / stats.totalChunks;
        
        const chunkInterval = Date.now() - stats.lastChunkTime;
        stats.lastChunkTime = Date.now();

        // Convert chunk to Buffer
        let buffer;
        if (chunk instanceof ArrayBuffer) {
            buffer = Buffer.from(chunk);
        } else if (Buffer.isBuffer(chunk)) {
            buffer = chunk;
        } else {
            // console.error(`❌ Invalid chunk format for room ${roomId}`);
            return;
        }

        // Debug: Log first few bytes of chunk
        if (chunkNumber % 10 === 0) {
            const firstBytes = buffer.slice(0, 16);
            //// console.log(`🔍 Chunk ${chunkNumber} first 16 bytes:`, firstBytes);
        }

        // Add to input buffer for smooth processing
        this.addToInputBuffer(roomId, buffer, chunkNumber);

        // Process buffered chunks
        this.processBufferedChunks(roomId, socket);
    }

    initializeRoomBuffers(roomId) {
        if (!this.streamStats.has(roomId)) {
            this.streamStats.set(roomId, {
                totalChunks: 0,
                totalBytes: 0,
                lastChunkTime: Date.now(),
                averageChunkSize: 0,
                startTime: Date.now(),
                dropCount: 0
            });
        }

        if (!this.inputBuffers.has(roomId)) {
            this.inputBuffers.set(roomId, []);
            this.bufferThresholds.set(roomId, {
                minBufferSize: 2,
                maxBufferSize: 8,
                currentSize: 0,
                processing: false
            });
            this.processingQueues.set(roomId, []);
            this.fragmentBuffers.set(roomId, []);
        }
    }

    addToInputBuffer(roomId, buffer, chunkNumber) {
        const inputBuffer = this.inputBuffers.get(roomId);
        const threshold = this.bufferThresholds.get(roomId);
        
        inputBuffer.push({
            buffer,
            chunkNumber,
            timestamp: Date.now()
        });
        
        threshold.currentSize = inputBuffer.length;
        
        // Maintain buffer size
        if (threshold.currentSize > threshold.maxBufferSize) {
            const removed = inputBuffer.shift();
            threshold.currentSize--;
            //// console.log(`Buffer overflow for room ${roomId}, removed chunk ${removed?.chunkNumber}`);
        }
    }

    async processBufferedChunks(roomId, socket) {
        const threshold = this.bufferThresholds.get(roomId);
        
        // Start processing immediately for debugging
        if (threshold.processing) {
            return;
        }

        threshold.processing = true;
        
        try {
            let ffmpegProcess = this.ffmpegProcesses.get(roomId);

            if (!ffmpegProcess) {
                //// console.log(`🚀 Starting optimized FFmpeg process for MP4 room ${roomId}`);
                ffmpegProcess = await this.startOptimizedFfmpegProcess(roomId, socket);
                if (!ffmpegProcess) {
                    // console.error(`❌ Failed to start FFmpeg for room ${roomId}`);
                    threshold.processing = false;
                    return;
                }
            }

            // Send MP4 initialization segment first if available and not sent yet
            if (!this.mp4Initialized.get(roomId) && this.mp4Headers.has(roomId)) {
                //// console.log(`📋 Sending MP4 init segment for room ${roomId}`);
                await this.sendMP4InitSegment(roomId, ffmpegProcess);
            } else if (!this.mp4Headers.has(roomId)) {
                // console.log(`⚠️ Processing without init segment for room ${roomId} (may cause issues)`);
            }

            // Process chunks sequentially
            await this.processChunkSequentially(roomId, ffmpegProcess);
            
        } catch (error) {
            // console.error(`❌ Error processing buffered chunks for room ${roomId}:`, error);
        } finally {
            threshold.processing = false;
        }
    }

    async sendMP4InitSegment(roomId, ffmpegProcess) {
        const initSegment = this.mp4Headers.get(roomId);
        if (!initSegment) {
            // console.log(`No MP4 init segment found for room ${roomId}`);
            return;
        }

        try {
            //// console.log(`Sending MP4 init segment to FFmpeg for room ${roomId}`);
            await this.writeChunkToFFmpeg(ffmpegProcess, initSegment, roomId);
            this.mp4Initialized.set(roomId, true);
            //// console.log(`MP4 init segment sent successfully for room ${roomId}`);
        } catch (error) {
            // console.error(`Error sending MP4 init segment for room ${roomId}:`, error);
            throw error;
        }
    }

    async processChunkSequentially(roomId, ffmpegProcess) {
        const inputBuffer = this.inputBuffers.get(roomId);
        const threshold = this.bufferThresholds.get(roomId);
        const stats = this.streamStats.get(roomId);

        if (!inputBuffer) {
            // console.log(`Input buffer for room ${roomId} no longer exists. Stopping chunk processing.`);
            return;
        }

        while (inputBuffer.length > 0 && ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
            const chunkData = inputBuffer.shift();
            threshold.currentSize--;

            try {
                await this.writeChunkToFFmpeg(ffmpegProcess, chunkData.buffer, roomId);
                
                await this.sleep(15);
                
            } catch (error) {
                // console.error(`Error writing MP4 chunk ${chunkData.chunkNumber} to FFmpeg:`, error);
                stats.dropCount++;
                
                if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
                    // console.warn(`FFmpeg pipe broken for room ${roomId}, restarting...`);
                    this.restartFfmpegProcess(roomId);
                    break;
                }
            }
        }
    }

    writeChunkToFFmpeg(ffmpegProcess, buffer, roomId) {
        return new Promise((resolve, reject) => {
            if (!ffmpegProcess.stdin || ffmpegProcess.stdin.destroyed) {
                reject(new Error('FFmpeg stdin not available'));
                return;
            }

            const written = ffmpegProcess.stdin.write(buffer, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });

            if (!written) {
                ffmpegProcess.stdin.once('drain', () => {
                    // console.log(`FFmpeg stdin drained for room ${roomId}`);
                    resolve(true);
                });
            }
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async startOptimizedFfmpegProcess(roomId, socket) {
        const hlsPath = path.join(__dirname, '..', '..', '..', 'public', 'streams', roomId);
        
        try {
            if (!fs.existsSync(hlsPath)) {
                fs.mkdirSync(hlsPath, { recursive: true });
                // console.log(`Created HLS directory: ${hlsPath}`);
            }
        } catch (error) {
            // console.error(`Error creating HLS directory for room ${roomId}:`, error);
            return null;
        }

        const ffmpegArgs = [
            '-loglevel', 'info',
            '-f', 'mp4',
            '-fflags', '+genpts+igndts+discardcorrupt',
            '-avoid_negative_ts', 'make_zero',
            '-i', 'pipe:0',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-tune', 'zerolatency',
            '-profile:v', 'baseline',
            '-level', '3.1',
            '-vf', 'scale=1280:720:flags=lanczos',
            '-r', '25',
            '-g', '50',
            '-keyint_min', '25',
            '-sc_threshold', '0',
            '-b:v', '1500k',
            '-maxrate', '2000k', 
            '-bufsize', '3000k',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '2',
            '-aac_coder', 'twoloop',
            '-profile:a', 'aac_low',
            '-max_muxing_queue_size', '1024',
            '-err_detect', 'ignore_err',
            '-f', 'hls',
            '-hls_time', '4',
            '-hls_list_size', '6',
            '-hls_delete_threshold', '3',
            '-hls_flags', 'delete_segments+independent_segments',
            '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', path.join(hlsPath, 'segment_%03d.ts'),
            '-hls_playlist_type', 'event',
            '-start_number', '0',
            '-hls_allow_cache', '1',
            path.join(hlsPath, 'stream.m3u8')
        ];

        // console.log('Starting FFmpeg with optimized MP4 configuration...');

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, AV_LOG_FORCE_NOCOLOR: '1' }
        });

        this.ffmpegProcesses.set(roomId, ffmpegProcess);

        ffmpegProcess.stdin.on('error', (err) => {
            if (err.code !== 'EPIPE' && err.code !== 'ECONNRESET') {
                // console.error(`FFmpeg stdin error for MP4 room ${roomId}:`, err);
                this.restartFfmpegProcess(roomId);
            }
        });

        ffmpegProcess.stdout.on('data', (data) => {
            // console.log(`FFmpeg stdout (MP4 ${roomId}): ${data.toString().trim()}`);
        });

        ffmpegProcess.stderr.on('data', async (data) => {
            const output = data.toString();
            
            if (output.includes('frame=') || 
                output.includes('Opening ') || 
                output.includes('Stream #0:') ||
                output.includes('Output #0') ||
                output.includes('Input #0') ||
                output.includes('encoder')) {
                const room = this.rooms.get(roomId);
                if (room && !room.streamStarted) {
                    room.streamStarted = true;
                    //// console.log(`🎥 STREAM LIVE for room ${roomId} - notifying viewers`);
                    await this.updateStreamStatus(roomId, true);
                    this.notifyStreamLive(roomId);
                }
            }
            
            if (output.includes('frame=')) {
                const frameMatch = output.match(/frame=\s*(\d+)/);
                if (frameMatch) {
                    const frameNum = parseInt(frameMatch[1]);
                    if (frameNum % 100 === 0) {
                        // console.log(`📹 Stream progress: ${output.trim()}`);
                    }
                }
            }
            else if (output.includes('Opening ') && output.includes('.ts')) {
                // console.log(`📦 Creating HLS segment: ${output.trim()}`);
            }
            else if (output.includes('Opening ') && output.includes('.m3u8')) {
                // console.log(`📋 Updating playlist: ${output.trim()}`);
            }
            else if (output.includes('decode_band_types') ||
                     output.includes('Input buffer exhausted') ||
                     output.includes('Invalid data found')) {
                // console.warn(`⚠️ Non-critical decoding issue: ${output.trim()}`);
            }
            else if (output.includes('Error') && 
                     !output.includes('decode_band_types') &&
                     !output.includes('Input buffer exhausted')) {
                // console.error(`❌ FFmpeg ERROR: ${output.trim()}`);
            }
        });

        ffmpegProcess.on('close', async (code, signal) => {
            //// console.log(`FFmpeg process for MP4 room ${roomId} closed with code ${code}, signal ${signal}`);
            this.ffmpegProcesses.delete(roomId);
            this.cleanupRoomBuffers(roomId);
            
            this.cleanupHLSFiles(hlsPath, roomId);
            
            // Cập nhật trạng thái isLive=false trong database khi stream kết thúc
            await this.updateStreamStatus(roomId, false);

            const room = this.rooms.get(roomId);
            if (room) {
                room.streamStarted = false;
            }
        });

        ffmpegProcess.on('error', (error) => {
            // console.error(`FFmpeg process error for MP4 room ${roomId}:`, error);
            this.ffmpegProcesses.delete(roomId);
            this.cleanupRoomBuffers(roomId);
        });

        await this.sleep(2000);
        
        if (ffmpegProcess.killed) {
            // console.error(`❌ FFmpeg process was killed during initialization for room ${roomId}`);
            return null;
        }
        
        try {
            const files = fs.readdirSync(hlsPath);
            // console.log(`📁 HLS directory contents for room ${roomId}:`, files);
        } catch (error) {
            // console.warn(`⚠️ Could not read HLS directory: ${error.message}`);
        }
        
        // console.log(`✅ FFmpeg process initialized for room ${roomId}`);
        
        return ffmpegProcess;
    }

    async updateStreamStatus(roomId, isLive) {
        try {
            const stream = await Stream.findOne({ where: { streamKey: roomId } });
            if (stream) {
                stream.isLive = isLive;
                if (isLive && !stream.startTime) {
                    stream.startTime = new Date();
                    const baseUrl = process.env.BASE_URL || `https://api2.scoliv2.com/api/v2`;
                    stream.hlsUrl = `${baseUrl}/streams/${roomId}/stream.m3u8`;
                } else if (!isLive) {
                    stream.endTime = new Date();
                    if (stream.startTime) {
                        stream.duration = Math.floor((stream.endTime - stream.startTime) / 1000);
                    }
                    stream.hlsUrl = null; 
                }
                await stream.save();
            } else {
                console.warn(`⚠️ Could not find stream with key ${roomId} to update status.`);
            }
        } catch (error) {
            console.error(`❌ Error updating stream status in DB for room ${roomId}:`, error);
        }
    }

    cleanupRoomBuffers(roomId) {
        this.inputBuffers.delete(roomId);
        this.bufferThresholds.delete(roomId);
        this.processingQueues.delete(roomId);
        this.streamStats.delete(roomId);
        this.mp4Headers.delete(roomId);
        this.mp4Initialized.delete(roomId);
        this.fragmentBuffers.delete(roomId);
    }

    restartFfmpegProcess(roomId) {
        // console.log(`Restarting FFmpeg process for MP4 room ${roomId}`);
        
        const existingProcess = this.ffmpegProcesses.get(roomId);
        if (existingProcess) {
            existingProcess.kill('SIGTERM');
            this.ffmpegProcesses.delete(roomId);
        }

        const threshold = this.bufferThresholds.get(roomId);
        if (threshold) {
            threshold.processing = false;
        }

        this.mp4Initialized.set(roomId, false);

        setTimeout(async () => {
            try {
                const newProcess = await this.startOptimizedFfmpegProcess(roomId);
                if (!newProcess) {
                    // console.error(`Failed to restart FFmpeg for MP4 room ${roomId}`);
                }
            } catch (error) {
                // console.error(`Error restarting FFmpeg for MP4 room ${roomId}:`, error);
            }
        }, 3000);
    }

    notifyStreamLive(roomId) {
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
        const hlsUrl = `${baseUrl}/streams/${roomId}/stream.m3u8`;
        
        this.io.to(`stream_${roomId}`).emit('stream_live', {
            roomId,
            hlsUrl,
            masterUrl: hlsUrl,
            qualities: [
                { resolution: '720p', url: hlsUrl }
            ],
            inputFormat: 'mp4',
            timestamp: Date.now()
        });
        
        // console.log(`MP4 Stream for room ${roomId} is now live at ${hlsUrl}`);
    }

    handleStreamStats(socket, roomId) {
        const stats = this.streamStats.get(roomId);
        const threshold = this.bufferThresholds.get(roomId);
        
        if (stats) {
            const currentTime = Date.now();
            const runtime = (currentTime - stats.startTime) / 1000;
            const throughput = stats.totalBytes / runtime;
            
            socket.emit('stream_stats', {
                roomId,
                totalChunks: stats.totalChunks,
                totalBytes: stats.totalBytes,
                averageChunkSize: Math.round(stats.averageChunkSize),
                runtime: Math.round(runtime),
                throughput: Math.round(throughput),
                dropCount: stats.dropCount,
                bufferSize: threshold ? threshold.currentSize : 0,
                bufferHealth: threshold ? {
                    min: threshold.minBufferSize,
                    max: threshold.maxBufferSize,
                    current: threshold.currentSize,
                    processing: threshold.processing
                } : null,
                mp4Initialized: this.mp4Initialized.get(roomId) || false,
                hasInitSegment: this.mp4Headers.has(roomId),
                inputFormat: 'mp4',
                timestamp: currentTime
            });
        }
    }

    cleanupHLSFiles(hlsPath, roomId) {
        fs.rm(hlsPath, { recursive: true, force: true }, (err) => {
            if (err) {
                // console.error(`Error cleaning up HLS directory for ${roomId}:`, err);
            } else {
                // console.log(`Cleaned up HLS directory for ${roomId}`);
            }
        });
    }

    handleLeaveRoom(socket, roomId) {
        if (!roomId) return;

        const userSession = this.userSessions.get(socket.id);
        const room = this.rooms.get(roomId);

        if (room && room.clients.has(socket.id)) {
            if (userSession && userSession.clientType === 'creator') {
                // console.log(`Creator ${userSession.username} left MP4 room ${roomId}. Stopping stream.`);
                const ffmpegProcess = this.ffmpegProcesses.get(roomId);
                if (ffmpegProcess && ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
                    ffmpegProcess.stdin.end();
                    
                    setTimeout(() => {
                        if (this.ffmpegProcesses.has(roomId)) {
                            ffmpegProcess.kill('SIGKILL');
                            this.ffmpegProcesses.delete(roomId);
                        }
                    }, 5000);
                }
                
                this.io.to(`stream_${roomId}`).emit('stream_ended', {
                    reason: 'creator_left',
                    timestamp: Date.now()
                });
            }

            room.clients.delete(socket.id);

            socket.to(`stream_${roomId}`).emit('user_left', {
                userId: userSession?.userId,
                username: userSession?.username,
                timestamp: Date.now()
            });

            this.io.to(`stream_${roomId}`).emit('viewer_count_updated', {
                count: room.clients.size
            });

            if (room.clients.size === 0) {
                this.rooms.delete(roomId);
                // console.log(`MP4 Room ${roomId} cleaned up - no more clients`);
                
                const ffmpegProcess = this.ffmpegProcesses.get(roomId);
                if (ffmpegProcess) {
                    // console.log(`Stopping FFmpeg for empty MP4 room ${roomId}`);
                    ffmpegProcess.kill('SIGTERM');
                    this.ffmpegProcesses.delete(roomId);
                }
                
                this.cleanupRoomBuffers(roomId);
            }
        }

        socket.leave(`stream_${roomId}`);

        if (userSession) {
            userSession.currentRoom = null;
        }
    }
}

module.exports = StreamHandler;