const config = require('../../config');
const { generateCloudinarySignature } = require('../../utils/helpers');
const logger = require('../../utils/logger');

class CloudinaryController {
  // Tạo chữ ký cho Cloudinary upload
  generateSignature = (req, res) => {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const { folder, tags, transformation } = req.body;
      
      const defaultFolder = `uploads/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      const toTransformationString = (t) => {
        if (!t) {
          return 'w_1200,h_1200,c_limit,q_auto:good,f_auto,dpr_auto,fl_progressive';
        }
        if (typeof t === 'string') return t;
        if (Array.isArray(t)) t = t[0];
        return [
          t.width ? `w_${t.width}` : '',
          t.height ? `h_${t.height}` : '',
          t.crop ? `c_${t.crop}` : '',
          t.quality ? `q_${t.quality}` : '',
          t.fetch_format ? `f_${t.fetch_format}` : '',
          t.dpr ? `dpr_${t.dpr}` : '',
          t.flags ? `fl_${t.flags}` : ''
        ].filter(Boolean).join(',');
      };

      const paramsForSignature = {
        timestamp,
        upload_preset: 'MNCR',
        folder: folder || defaultFolder,
        tags: tags || 'web_upload,optimized',
        transformation: toTransformationString(transformation)
      };

      const signature = generateCloudinarySignature(paramsForSignature, config.CLOUD_API_SECRET);

      res.json({
        success: true,
        data: {
          timestamp: paramsForSignature.timestamp,
          upload_preset: paramsForSignature.upload_preset,
          folder: paramsForSignature.folder,
          tags: paramsForSignature.tags,
          transformation: paramsForSignature.transformation,
          
          signature,
          api_key: config.CLOUD_API_KEY,
          cloud_name: config.CLOUD_NAME,
          
          use_filename: true,
          unique_filename: true,
          overwrite: false
        }
      });

      logger.info(`Cloudinary signature generated for folder: ${paramsForSignature.folder}`);

    } catch (error) {
      logger.error('Error generating Cloudinary signature:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to generate signature',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };

  // Tạo URLs tối ưu cho Cloudinary
  generateOptimizedUrls = (req, res) => {
    try {
      const { public_id } = req.body;
      
      if (!public_id) {
        return res.status(400).json({ 
          success: false,
          error: 'public_id is required' 
        });
      }

      const baseUrl = `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload`;
      
      const optimizedUrls = {
        original: `${baseUrl}/${public_id}`,
        optimized: `${baseUrl}/q_auto:good,f_auto,dpr_auto/${public_id}`,
        thumbnail: `${baseUrl}/w_300,h_300,c_fill,g_auto,q_auto:good,f_auto/${public_id}`,
        placeholder: `${baseUrl}/w_50,h_50,c_fill,q_auto:low,e_blur:1000,f_auto/${public_id}`,
        responsive: {
          mobile: `${baseUrl}/w_480,c_limit,q_auto:good,f_auto,dpr_auto/${public_id}`,
          tablet: `${baseUrl}/w_768,c_limit,q_auto:good,f_auto,dpr_auto/${public_id}`,
          desktop: `${baseUrl}/w_1200,c_limit,q_auto:good,f_auto,dpr_auto/${public_id}`,
          retina: `${baseUrl}/w_2400,c_limit,q_auto:good,f_auto,dpr_auto/${public_id}`
        }
      };

      res.json({
        success: true,
        data: {
          public_id,
          urls: optimizedUrls,
          srcset: [
            `${optimizedUrls.responsive.mobile} 480w`,
            `${optimizedUrls.responsive.tablet} 768w`,
            `${optimizedUrls.responsive.desktop} 1200w`,
            `${optimizedUrls.responsive.retina} 2400w`
          ].join(', ')
        }
      });

      logger.info(`Optimized URLs generated for public_id: ${public_id}`);

    } catch (error) {
      logger.error('Error generating optimized URLs:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to generate URLs',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };
}

module.exports = new CloudinaryController();