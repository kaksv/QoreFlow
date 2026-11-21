// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IQoreFlowWithdraw {
    function withdraw(uint256 streamId) external;
}

/// @notice TEST-ONLY recipient that re-enters `withdraw` from its receive hook.
contract ReentrantRecipient {
    IQoreFlowWithdraw public immutable flow;
    uint256 public streamId;
    bool private _entered;

    constructor(address flowAddress) {
        flow = IQoreFlowWithdraw(flowAddress);
    }

    function attack(uint256 id) external {
        streamId = id;
        flow.withdraw(id);
    }

    receive() external payable {
        if (!_entered) {
            _entered = true;
            flow.withdraw(streamId);
        }
    }
}

/// @notice TEST-ONLY recipient that rejects every transfer.
contract RejectingRecipient {
    function withdrawFrom(address flow, uint256 streamId) external {
        IQoreFlowWithdraw(flow).withdraw(streamId);
    }

    receive() external payable {
        revert("no thanks");
    }
}
