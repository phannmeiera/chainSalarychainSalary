// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ChainSalary - DAO 工资发放管理（FHEVM 版本）
/// @notice 工资（每周期）以加密形式存储；发薪周期与时间为明文；领取时在链上计算并解密金额后转账（透明可审计）。
contract SalaryManager is SepoliaConfig, ReentrancyGuard {

    struct Employee {
        euint64 salaryPerCycle;      // 加密的每周期工资（用于隐私展示/解密）
        uint64 salaryPerCycleClear;  // 明文每周期工资（用于链上转账计算）
        uint64 cycleSeconds;         // 周期（秒）
        uint64 lastClaimAt;          // 上次领取时间
        bool active;                 // 是否有效（冻结/离职）
    }

    event EmployeeAdded(address indexed emp, uint64 cycleSeconds);
    event EmployeeUpdated(address indexed emp);
    event EmployeePaused(address indexed emp);
    event EmployeeRemoved(address indexed emp);
    event FundedDAO(address indexed from, uint256 amount);
    event SalaryPaid(address indexed emp, uint256 amount, uint64 nextPayday);
    event Withdraw(address indexed to, uint256 amount);

    address public immutable admin;
    uint256 public totalPaid;      // 已支付总额（明文统计，单位：wei）

    mapping(address => Employee) private employees;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // -------------------- 管理员：员工管理 --------------------

    function addEmployee(
        address emp,
        externalEuint64 encSalary,
        bytes calldata inputProof,
        uint64 cycleSeconds,
        uint64 salaryPerCycleClear
    ) external onlyAdmin {
        require(emp != address(0), "emp=0");
        require(cycleSeconds > 0, "cycle=0");
        require(salaryPerCycleClear > 0, "salary=0");

        euint64 s = FHE.fromExternal(encSalary, inputProof);

        Employee storage e = employees[emp];
        e.salaryPerCycle = s;
        e.salaryPerCycleClear = salaryPerCycleClear;
        e.cycleSeconds = cycleSeconds;
        e.lastClaimAt = uint64(block.timestamp);
        e.active = true;

        // 允许本合约继续访问/授权；允许员工解密查看自己的工资
        FHE.allowThis(e.salaryPerCycle);
        FHE.allow(e.salaryPerCycle, emp);

        emit EmployeeAdded(emp, cycleSeconds);
    }

    function updateSalary(
        address emp,
        externalEuint64 encSalary,
        bytes calldata inputProof,
        uint64 newSalaryPerCycleClear
    ) external onlyAdmin {
        Employee storage e = employees[emp];
        require(e.active, "not active");
        require(newSalaryPerCycleClear > 0, "salary=0");

        euint64 s = FHE.fromExternal(encSalary, inputProof);
        e.salaryPerCycle = s;
        e.salaryPerCycleClear = newSalaryPerCycleClear;

        FHE.allowThis(e.salaryPerCycle);
        FHE.allow(e.salaryPerCycle, emp);

        emit EmployeeUpdated(emp);
    }

    function updateCycle(address emp, uint64 newCycleSeconds) external onlyAdmin {
        Employee storage e = employees[emp];
        require(e.active, "not active");
        require(newCycleSeconds > 0, "cycle=0");
        e.cycleSeconds = newCycleSeconds;
        emit EmployeeUpdated(emp);
    }

    function pauseEmployee(address emp) external onlyAdmin {
        Employee storage e = employees[emp];
        require(e.active, "already paused");
        e.active = false;
        emit EmployeePaused(emp);
    }

    function removeEmployee(address emp) external onlyAdmin {
        Employee storage e = employees[emp];
        require(e.lastClaimAt != 0, "unknown emp");
        delete employees[emp];
        emit EmployeeRemoved(emp);
    }

    // -------------------- 管理员：资金管理 --------------------

    function fundContract() external payable onlyAdmin {
        require(msg.value > 0, "amount=0");
        emit FundedDAO(msg.sender, msg.value);
    }

    function withdrawUnallocatedFunds(address payable to, uint256 amount) external onlyAdmin {
        require(to != address(0), "to=0");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "eth transfer failed");
        emit Withdraw(to, amount);
    }

    // -------------------- 员工：领取工资 --------------------

    function claimSalary() external nonReentrant {
        Employee storage e = employees[msg.sender];
        require(e.active, "not active");
        require(e.cycleSeconds > 0, "cycle=0");

        uint256 elapsed = block.timestamp - uint256(e.lastClaimAt);
        uint256 periods = elapsed / uint256(e.cycleSeconds);
        require(periods > 0, "not due");

        // 计算应领金额（明文用于链上转账）。隐私版本的工资在链上仍以密文存储供前端解密展示。
        uint256 due = uint256(e.salaryPerCycleClear) * periods;
        require(due > 0, "due=0");
        require(address(this).balance >= due, "insufficient DAO funds");

        e.lastClaimAt = uint64(uint256(e.lastClaimAt) + periods * uint256(e.cycleSeconds));
        totalPaid += due;

        (bool ok, ) = msg.sender.call{value: due}("");
        require(ok, "eth transfer failed");
        emit SalaryPaid(msg.sender, due, e.lastClaimAt + e.cycleSeconds);
    }

    // -------------------- 只读查询 --------------------

    function getEmployeeInfo(address emp)
        external
        view
        returns (euint64 salaryPerCycle, uint64 cycleSeconds, uint64 lastClaimAt, bool active)
    {
        Employee storage e = employees[emp];
        return (e.salaryPerCycle, e.cycleSeconds, e.lastClaimAt, e.active);
    }

    function getNextPayday(address emp) external view returns (uint64) {
        Employee storage e = employees[emp];
        if (e.cycleSeconds == 0) return 0;
        return e.lastClaimAt + e.cycleSeconds;
    }

    function getDAOFunds() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit FundedDAO(msg.sender, msg.value);
    }
}


