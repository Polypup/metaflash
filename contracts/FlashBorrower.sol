// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.5.0;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";
// import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "./libraries/SafeMath.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IFlashLender.sol";

contract FlashBorrower is IERC3156FlashBorrower {
    using SafeMath for uint256;

    enum Action {
        NORMAL,
        STEAL,
        REENTER
    }

    bytes32 public constant CALLBACK_SUCCESS =
        keccak256("ERC3156FlashBorrower.onFlashLoan");

    uint256 public flashBalance;
    address public flashSender;
    address public flashToken;
    uint256 public flashAmount;
    uint256 public flashFee;
    uint256 public totalFlashBalance;

    /// @dev ERC-3156 Flash loan callback
    function onFlashLoan(
        address sender,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        require(
            sender == address(this),
            "FlashBorrower: External loan initiator"
        );
        Action action = abi.decode(data, (Action)); // Use this to unpack arbitrary data
        flashSender = sender;
        flashToken = token;
        flashAmount = amount;
        flashFee = fee;
        if (action == Action.NORMAL) {
            flashBalance = IERC20(token).balanceOf(address(this));
            totalFlashBalance = totalFlashBalance.add(amount).add(fee);
        } else if (action == Action.STEAL) {
            // do nothing
        } else if (action == Action.REENTER) {
            // flashBorrow(IERC3156FlashLender(msg.sender), token, amount * 2);
        }
        return CALLBACK_SUCCESS;
    }

    function flashBorrowWithCheapestProvider(
        IFlashLender lender,
        address token,
        uint256 amount
    ) public {
        uint256 _allowance = IERC20(token).allowance(
            address(this),
            address(lender)
        );
        uint256 _fee = lender.flashFeeWithCheapestProvider(token, amount);
        uint256 _repayment = amount.add(_fee);
        IERC20(token).approve(address(lender), _allowance.add(_repayment));
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.NORMAL);
        lender.flashLoanWithCheapestProvider(this, token, amount, data);
    }

    function flashBorrowWithManyProviders(
        IFlashLender lender,
        address token,
        uint256 amount
    ) public {
        uint256 _allowance = IERC20(token).allowance(
            address(this),
            address(lender)
        );
        uint256 _fee = lender.flashFeeWithManyProviders(token, amount);
        uint256 _repayment = amount.add(_fee);
        IERC20(token).approve(address(lender), _allowance.add(_repayment));
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.NORMAL);
        lender.flashLoanWithManyProviders(this, token, amount, data);
    }
}
