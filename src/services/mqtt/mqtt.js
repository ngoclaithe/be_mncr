const mqtt = require('mqtt');
const config = require('../../config');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.subscriptions = new Map();
  }

  /**
   * Kết nối đến MQTT broker
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        const options = {
          username: config.MQTT_USERNAME,
          password: config.MQTT_PASSWORD,
          clientId: `mqtt_client_${Math.random().toString(16).substr(2, 8)}`,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30 * 1000,
          keepalive: 60,
        };

        // Tạo broker URL với port
        const brokerUrl = `${config.MQTT_BROKER}:${config.MQTT_PORT}`;
        this.client = mqtt.connect(brokerUrl, options);

        this.client.on('connect', () => {
          console.log('✅ MQTT connected successfully');
          this.isConnected = true;
          resolve(this.client);
        });

        this.client.on('error', (error) => {
          console.error('❌ MQTT connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.client.on('close', () => {
          console.log('🔌 MQTT connection closed');
          this.isConnected = false;
        });

        this.client.on('offline', () => {
          console.log('📴 MQTT client offline');
          this.isConnected = false;
        });

        this.client.on('reconnect', () => {
          console.log('🔄 MQTT reconnecting...');
        });

        this.client.on('message', (topic, message) => {
          this.handleMessage(topic, message);
        });

      } catch (error) {
        console.error('❌ Failed to create MQTT client:', error);
        reject(error);
      }
    });
  }

  /**
   * Ngắt kết nối MQTT
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(true, () => {
          console.log('🔌 MQTT disconnected');
          this.isConnected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Publish message đến topic
   * @param {string} topic - MQTT topic
   * @param {string|object} payload - Dữ liệu cần gửi
   * @param {object} options - Tùy chọn publish (qos, retain, etc.)
   */
  publish(topic, payload, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client is not connected'));
        return;
      }

      let message;
      if (typeof payload === 'object') {
        message = JSON.stringify(payload);
      } else {
        message = payload.toString();
      }

      const publishOptions = {
        qos: options.qos || 0,
        retain: options.retain || false,
        ...options
      };

      this.client.publish(topic, message, publishOptions, (error) => {
        if (error) {
          console.error(`❌ Failed to publish to ${topic}:`, error);
          reject(error);
        } else {
          console.log(`📤 Published to ${topic}:`, message);
          resolve();
        }
      });
    });
  }

  /**
   * Subscribe đến topic
   * @param {string|string[]} topics - Topic hoặc array các topic
   * @param {function} callback - Callback xử lý message nhận được
   * @param {object} options - Tùy chọn subscribe (qos, etc.)
   */
  subscribe(topics, callback, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client is not connected'));
        return;
      }

      const subscribeOptions = {
        qos: options.qos || 0,
        ...options
      };

      // Đảm bảo topics là array
      const topicArray = Array.isArray(topics) ? topics : [topics];

      this.client.subscribe(topicArray, subscribeOptions, (error, granted) => {
        if (error) {
          console.error('❌ Failed to subscribe:', error);
          reject(error);
        } else {
          console.log('📥 Subscribed to topics:', granted);
          
          // Lưu callback cho các topic
          topicArray.forEach(topic => {
            this.subscriptions.set(topic, callback);
          });
          
          resolve(granted);
        }
      });
    });
  }

  /**
   * Unsubscribe khỏi topic
   * @param {string|string[]} topics - Topic hoặc array các topic
   */
  unsubscribe(topics) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client is not connected'));
        return;
      }

      const topicArray = Array.isArray(topics) ? topics : [topics];

      this.client.unsubscribe(topicArray, (error) => {
        if (error) {
          console.error('❌ Failed to unsubscribe:', error);
          reject(error);
        } else {
          console.log('📤 Unsubscribed from topics:', topicArray);
          
          // Xóa callback
          topicArray.forEach(topic => {
            this.subscriptions.delete(topic);
          });
          
          resolve();
        }
      });
    });
  }

  /**
   * Xử lý message nhận được
   * @param {string} topic - Topic nhận được message
   * @param {Buffer} message - Message buffer
   */
  handleMessage(topic, message) {
    try {
      const messageStr = message.toString();
      console.log(`📨 Received message from ${topic}:`, messageStr);

      // Tìm callback phù hợp cho topic
      let callback = null;
      
      // Tìm exact match trước
      if (this.subscriptions.has(topic)) {
        callback = this.subscriptions.get(topic);
      } else {
        // Tìm wildcard match
        for (let [subscribedTopic, cb] of this.subscriptions) {
          if (this.matchTopic(subscribedTopic, topic)) {
            callback = cb;
            break;
          }
        }
      }

      if (callback) {
        // Parse JSON nếu có thể
        let payload;
        try {
          payload = JSON.parse(messageStr);
        } catch (e) {
          payload = messageStr;
        }

        callback(topic, payload, message);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
    }
  }

  /**
   * Kiểm tra topic có match với pattern không (hỗ trợ wildcard + và #)
   * @param {string} pattern - Pattern với wildcard
   * @param {string} topic - Topic cần kiểm tra
   */
  matchTopic(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      
      // # wildcard - match tất cả level còn lại
      if (patternPart === '#') {
        return true;
      }
      
      // + wildcard - match exactly 1 level
      if (patternPart === '+') {
        if (i >= topicParts.length) {
          return false;
        }
        continue;
      }
      
      // Exact match
      if (i >= topicParts.length || patternPart !== topicParts[i]) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isClientConnected() {
    return this.isConnected && this.client && this.client.connected;
  }

  /**
   * Lấy thông tin client
   */
  getClientInfo() {
    if (!this.client) {
      return null;
    }

    return {
      connected: this.isConnected,
      clientId: this.client.options.clientId,
      broker: `${config.MQTT_BROKER}:${config.MQTT_PORT}`,
      subscriptions: Array.from(this.subscriptions.keys())
    };
  }
}

// Tạo singleton instance
const mqttService = new MQTTService();

module.exports = mqttService;