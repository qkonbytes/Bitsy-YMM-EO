const crypto = require('crypto');

module.exports = async function handler(req, res) {
  const params = Object.assign({}, req.query);
  const hmac = params.hmac;
  
  delete params.hmac;
  delete params.state;
  delete params.host;

  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const secret = process.env.SHOPIFY_API_SECRET;
  
  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return res.status(200).json({
    message,
    expected_hmac: hmac,
    generated_hmac: generatedHmac,
    match: generatedHmac === hmac,
    secret_length: secret?.length,
    secret_preview: secret?.substring(0, 4)
  });
};