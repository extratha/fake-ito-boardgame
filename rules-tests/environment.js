// jest 27 ไม่ส่ง fetch ของ Node เข้าไปใน environment ของเทสต์ แต่ rules-unit-testing ใช้ fetch คุยกับ emulator
const NodeEnvironment = require('jest-environment-node');

class NodeWithFetchEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    Object.assign(this.global, { fetch, Headers, Request, Response });
  }
}

module.exports = NodeWithFetchEnvironment;
