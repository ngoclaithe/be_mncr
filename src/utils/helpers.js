const crypto = require("crypto");

/**
 * Generate Cloudinary signature with detailed logging
 * @param {Object} params - Object gồm các param cần ký
 * @param {string} apiSecret - Cloudinary API Secret
 * @returns {string} signature
 */
const generateCloudinarySignature = (params, apiSecret) => {
  const allowedParams = {};
  const excludeFromSigning = ['api_key', 'cloud_name', 'resource_type', 'file'];
  
  Object.keys(params).forEach(key => {
    if (!excludeFromSigning.includes(key) && params[key] !== undefined && params[key] !== null) {
      allowedParams[key] = params[key];
    }
  });

  const sortedParams = Object.keys(allowedParams)
    .sort()
    .map((key) => `${key}=${allowedParams[key]}`)
    .join("&");

  console.log('🔐 String to sign:', sortedParams);
  
  const stringToSign = sortedParams + apiSecret;
  const signature = crypto.createHash("sha256").update(stringToSign).digest("hex");
  
  console.log('🔐 Generated signature:', signature.substring(0, 8) + '...');
  
  return signature;
};


module.exports = {
  generateCloudinarySignature  
};