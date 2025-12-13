module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'defaultSecret'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'defaultSalt'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'defaultSalt'),
    },
  },
});

