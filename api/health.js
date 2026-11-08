module.exports = (req, res) => res.status(200).json({
  service: 'ethykos-next-api',
  version: '4.15.2',
  configured: {
    firebase: !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_DATABASE_URL
    ),
    resend: !!process.env.RESEND_API_KEY
  }
});
