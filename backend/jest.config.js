// jest.config.js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "utils/**/*.js",
    "services/**/*.js",
    "models/**/*.js",
    "routes/**/*.js",
    "middleware/**/*.js",
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
  verbose: true,
};
