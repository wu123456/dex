// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DEXFactory.sol";
import "./DEXPair.sol";

contract LiquidityMining is ReentrancyGuard {
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pendingRewards;
    }

    struct PoolInfo {
        address pair;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accRewardPerShare;
    }

    IERC20 public rewardToken;
    uint256 public rewardPerBlock;
    uint256 public totalAllocPoint;
    uint256 public startBlock;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event Harvest(address indexed user, uint256 indexed pid, uint256 reward);

    constructor(
        address _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock
    ) {
        rewardToken = IERC20(_rewardToken);
        rewardPerBlock = _rewardPerBlock;
        startBlock = _startBlock;
    }

    function addPool(address pair, uint256 allocPoint) external {
        if (poolInfo.length > 0) {
            _updatePool(0);
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint += allocPoint;
        poolInfo.push(PoolInfo({
            pair: pair,
            allocPoint: allocPoint,
            lastRewardBlock: lastRewardBlock,
            accRewardPerShare: 0
        }));
    }

    function deposit(uint256 pid, uint256 amount) external nonReentrant {
        require(pid < poolInfo.length, "LiquidityMining: INVALID_PID");
        _updatePool(pid);

        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];

        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accRewardPerShare / 1e12) - user.rewardDebt;
            if (pending > 0) {
                user.pendingRewards += pending;
            }
        }

        if (amount > 0) {
            IERC20(pool.pair).transferFrom(msg.sender, address(this), amount);
            user.amount += amount;
        }

        user.rewardDebt = user.amount * pool.accRewardPerShare / 1e12;

        emit Deposit(msg.sender, pid, amount);
    }

    function withdraw(uint256 pid, uint256 amount) external nonReentrant {
        require(pid < poolInfo.length, "LiquidityMining: INVALID_PID");
        _updatePool(pid);

        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];

        require(user.amount >= amount, "LiquidityMining: INSUFFICIENT_BALANCE");

        uint256 pending = (user.amount * pool.accRewardPerShare / 1e12) - user.rewardDebt;
        if (pending > 0) {
            user.pendingRewards += pending;
        }

        if (amount > 0) {
            user.amount -= amount;
            IERC20(pool.pair).transfer(msg.sender, amount);
        }

        user.rewardDebt = user.amount * pool.accRewardPerShare / 1e12;

        emit Withdraw(msg.sender, pid, amount);
    }

    function harvest(uint256 pid) external nonReentrant {
        require(pid < poolInfo.length, "LiquidityMining: INVALID_PID");
        _updatePool(pid);

        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][msg.sender];

        uint256 pending = (user.amount * pool.accRewardPerShare / 1e12) - user.rewardDebt;
        uint256 reward = user.pendingRewards + pending;

        user.pendingRewards = 0;
        user.rewardDebt = user.amount * pool.accRewardPerShare / 1e12;

        if (reward > 0) {
            rewardToken.transfer(msg.sender, reward);
        }

        emit Harvest(msg.sender, pid, reward);
    }

    function pendingReward(uint256 pid, address userAddr) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[pid];
        UserInfo storage user = userInfo[pid][userAddr];

        uint256 accRewardPerShare = pool.accRewardPerShare;
        if (block.number > pool.lastRewardBlock && pool.allocPoint > 0) {
            uint256 blocks = block.number - pool.lastRewardBlock;
            uint256 reward = (blocks * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / IERC20(pool.pair).balanceOf(address(this));
        }

        return user.pendingRewards + (user.amount * accRewardPerShare / 1e12) - user.rewardDebt;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function _updatePool(uint256 pid) internal {
        PoolInfo storage pool = poolInfo[pid];
        if (block.number <= pool.lastRewardBlock) return;

        uint256 lpSupply = IERC20(pool.pair).balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 blocks = block.number - pool.lastRewardBlock;
        uint256 reward = (blocks * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
        pool.accRewardPerShare += (reward * 1e12) / lpSupply;
        pool.lastRewardBlock = block.number;
    }
}
