// เทสต์ database.rules.json กับ Firebase Emulator (แยกจากเทสต์ของแอปใน src ที่ใช้ fake database)
// รันด้วย: npm run test:rules
module.exports = {
  rootDir: __dirname,
  testEnvironment: '<rootDir>/environment.js',
  testTimeout: 20000,
};
