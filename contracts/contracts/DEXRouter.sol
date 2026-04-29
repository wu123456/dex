// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DEXFactory.sol";
import "./DEXPair.sol";
import "./libraries/DEXLibrary.sol";
import "./interfaces/IWETH.sol";

contract DEXRouter is ReentrancyGuard {
    address public immutable factory;
    address public immutable WETH;

    event LiquidityAdded(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        address indexed to
    );
    event LiquidityRemoved(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        address indexed to
    );
    event SwapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOut,
        address[] path,
        address indexed to
    );
    event SwapTokensForExactTokens(
        uint256 amountIn,
        uint256 amountOut,
        address[] path,
        address indexed to
    );

    modifier ensure(uint256 deadline) {
        require(block.timestamp <= deadline, "DEXRouter: EXPIRED");
        _;
    }

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        require(msg.sender == WETH, "DEXRouter: INVALID_SENDER");
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(
            tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin
        );
        address pair = DEXLibrary.pairFor(factory, tokenA, tokenB);
        IERC20(tokenA).transferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).transferFrom(msg.sender, pair, amountB);
        liquidity = DEXPair(pair).mint(to);

        emit LiquidityAdded(tokenA, tokenB, amountA, amountB, liquidity, to);
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable nonReentrant ensure(deadline) returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token, WETH, amountTokenDesired, msg.value, amountTokenMin, amountETHMin
        );
        address pair = DEXLibrary.pairFor(factory, token, WETH);
        IERC20(token).transferFrom(msg.sender, pair, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        require(IWETH(WETH).transfer(pair, amountETH), "DEXRouter: WETH_TRANSFER_FAILED");
        liquidity = DEXPair(pair).mint(to);

        if (msg.value > amountETH) {
            (bool success,) = msg.sender.call{value: msg.value - amountETH}("");
            require(success, "DEXRouter: ETH_REFUND_FAILED");
        }

        emit LiquidityAdded(token, WETH, amountToken, amountETH, liquidity, to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        (amountA, amountB) = _removeLiquidity(tokenA, tokenB, liquidity, to);
        require(amountA >= amountAMin, "DEXRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "DEXRouter: INSUFFICIENT_B_AMOUNT");

        emit LiquidityRemoved(tokenA, tokenB, amountA, amountB, liquidity, to);
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
        (amountToken, amountETH) = _removeLiquidity(token, WETH, liquidity, address(this));
        require(amountToken >= amountTokenMin, "DEXRouter: INSUFFICIENT_TOKEN_AMOUNT");
        require(amountETH >= amountETHMin, "DEXRouter: INSUFFICIENT_ETH_AMOUNT");
        IERC20(token).transfer(to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        (bool success,) = to.call{value: amountETH}("");
        require(success, "DEXRouter: ETH_TRANSFER_FAILED");

        emit LiquidityRemoved(token, WETH, amountToken, amountETH, liquidity, to);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
        amounts = DEXLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "DEXRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IERC20(path[0]).transferFrom(msg.sender, DEXLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);

        emit SwapExactTokensForTokens(amountIn, amounts[amounts.length - 1], path, to);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
        amounts = DEXLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "DEXRouter: EXCESSIVE_INPUT_AMOUNT");
        IERC20(path[0]).transferFrom(msg.sender, DEXLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);

        emit SwapTokensForExactTokens(amounts[0], amountOut, path, to);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "DEXRouter: INVALID_PATH");
        amounts = DEXLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "DEXRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IWETH(WETH).deposit{value: amounts[0]}();
        require(IWETH(WETH).transfer(DEXLibrary.pairFor(factory, path[0], path[1]), amounts[0]), "DEXRouter: WETH_TRANSFER_FAILED");
        _swap(amounts, path, to);

        emit SwapExactTokensForTokens(msg.value, amounts[amounts.length - 1], path, to);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "DEXRouter: INVALID_PATH");
        amounts = DEXLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "DEXRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IERC20(path[0]).transferFrom(msg.sender, DEXLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        (bool success,) = to.call{value: amounts[amounts.length - 1]}("");
        require(success, "DEXRouter: ETH_TRANSFER_FAILED");

        emit SwapExactTokensForTokens(amountIn, amounts[amounts.length - 1], path, to);
    }

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "DEXRouter: INVALID_PATH");
        amounts = DEXLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "DEXRouter: EXCESSIVE_INPUT_AMOUNT");
        IERC20(path[0]).transferFrom(msg.sender, DEXLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        (bool success,) = to.call{value: amounts[amounts.length - 1]}("");
        require(success, "DEXRouter: ETH_TRANSFER_FAILED");

        emit SwapTokensForExactTokens(amounts[0], amountOut, path, to);
    }

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable nonReentrant ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "DEXRouter: INVALID_PATH");
        amounts = DEXLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, "DEXRouter: EXCESSIVE_INPUT_AMOUNT");
        IWETH(WETH).deposit{value: amounts[0]}();
        require(IWETH(WETH).transfer(DEXLibrary.pairFor(factory, path[0], path[1]), amounts[0]), "DEXRouter: WETH_TRANSFER_FAILED");
        _swap(amounts, path, to);

        if (msg.value > amounts[0]) {
            (bool success,) = msg.sender.call{value: msg.value - amounts[0]}("");
            require(success, "DEXRouter: ETH_REFUND_FAILED");
        }

        emit SwapTokensForExactTokens(amounts[0], amountOut, path, to);
    }

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256) {
        return DEXLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        return DEXLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        return DEXLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory) {
        return DEXLibrary.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint256 amountOut, address[] memory path) public view returns (uint256[] memory) {
        return DEXLibrary.getAmountsIn(factory, amountOut, path);
    }

    function _removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        address to
    ) internal returns (uint256 amountA, uint256 amountB) {
        address pair = DEXLibrary.pairFor(factory, tokenA, tokenB);
        IERC20(pair).transferFrom(msg.sender, pair, liquidity);
        (uint256 amount0, uint256 amount1) = DEXPair(pair).burn(to);
        (address token0,) = DEXLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        address pair = DEXFactory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            DEXFactory(factory).createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = DEXLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = DEXLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "DEXRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = DEXLibrary.quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal <= amountADesired, "DEXRouter: EXCESSIVE_A_AMOUNT");
                require(amountAOptimal >= amountAMin, "DEXRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = DEXLibrary.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2
                ? DEXLibrary.pairFor(factory, output, path[i + 2])
                : _to;
            DEXPair(DEXLibrary.pairFor(factory, input, output)).swap(amount0Out, amount1Out, to);
        }
    }
}
