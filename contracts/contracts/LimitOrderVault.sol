// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DEXFactory.sol";
import "./DEXPair.sol";
import "./libraries/DEXLibrary.sol";

contract LimitOrderVault is ReentrancyGuard {
    struct Order {
        address maker;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 deadline;
        bool filled;
        bool cancelled;
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;

    event OrderCreated(uint256 indexed orderId, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event OrderFilled(uint256 indexed orderId, address indexed filler, uint256 amountOut);
    event OrderCancelled(uint256 indexed orderId);

    function createOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 orderId) {
        require(deadline > block.timestamp, "LimitOrderVault: EXPIRED");
        require(amountIn > 0 && amountOut > 0, "LimitOrderVault: ZERO_AMOUNT");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        orderId = nextOrderId++;
        orders[orderId] = Order({
            maker: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOut: amountOut,
            deadline: deadline,
            filled: false,
            cancelled: false
        });

        emit OrderCreated(orderId, msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function fillOrder(address factory, uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(!order.filled, "LimitOrderVault: ALREADY_FILLED");
        require(!order.cancelled, "LimitOrderVault: CANCELLED");
        require(block.timestamp <= order.deadline, "LimitOrderVault: EXPIRED");

        IERC20(order.tokenOut).transferFrom(msg.sender, order.maker, order.amountOut);

        address[] memory path = new address[](2);
        path[0] = order.tokenIn;
        path[1] = order.tokenOut;
        uint256[] memory amounts = DEXLibrary.getAmountsOut(factory, order.amountIn, path);

        if (amounts[1] >= order.amountOut) {
            IERC20(order.tokenIn).transfer(msg.sender, order.amountIn);
        } else {
            IERC20(order.tokenIn).approve(
                _getRouterFromFactory(factory),
                order.amountIn
            );
            IERC20(order.tokenOut).transferFrom(msg.sender, address(this), amounts[1] - order.amountOut);
        }

        order.filled = true;

        emit OrderFilled(orderId, msg.sender, order.amountOut);
    }

    function fillOrderDirect(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(!order.filled, "LimitOrderVault: ALREADY_FILLED");
        require(!order.cancelled, "LimitOrderVault: CANCELLED");
        require(block.timestamp <= order.deadline, "LimitOrderVault: EXPIRED");

        IERC20(order.tokenOut).transferFrom(msg.sender, order.maker, order.amountOut);
        IERC20(order.tokenIn).transfer(msg.sender, order.amountIn);

        order.filled = true;

        emit OrderFilled(orderId, msg.sender, order.amountOut);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(msg.sender == order.maker, "LimitOrderVault: NOT_MAKER");
        require(!order.filled, "LimitOrderVault: ALREADY_FILLED");
        require(!order.cancelled, "LimitOrderVault: ALREADY_CANCELLED");

        IERC20(order.tokenIn).transfer(order.maker, order.amountIn);
        order.cancelled = true;

        emit OrderCancelled(orderId);
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function _getRouterFromFactory(address) internal pure returns (address) {
        return address(0);
    }
}
