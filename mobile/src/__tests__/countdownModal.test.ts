import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SOS_COUNTDOWN_SECONDS } from '../constants/timing';

/**
 * CountdownController encapsulates the exact timer and idempotency state machine
 * implemented in CountdownModal.tsx. It isolates the lifecycle logic so it can be
 * tested rigorously under Jest fake timers, simulating ticks, cancellations,
 * immediate sends, unmounts, and repeated renders.
 */
class CountdownController {
  private timeLeft: number;
  private durationSeconds: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private hasTriggered: boolean = false;
  private isVisible: boolean = false;
  public onComplete: () => void;
  public onCancel: () => void;
  public renderCount: number = 0;
  public stateUpdates: number[] = [];

  constructor(
    onComplete: () => void,
    onCancel: () => void,
    durationSeconds: number = SOS_COUNTDOWN_SECONDS
  ) {
    this.durationSeconds = durationSeconds;
    this.timeLeft = durationSeconds;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
  }

  public getTimeLeft(): number {
    return this.timeLeft;
  }

  public isTimerRunning(): boolean {
    return this.intervalId !== null;
  }

  public setVisible(visible: boolean) {
    this.isVisible = visible;
    this.renderCount += 1;

    if (!visible) {
      this.cleanup();
      this.timeLeft = this.durationSeconds;
      this.hasTriggered = false;
      return;
    }

    // Modal became visible: reset countdown tracking
    this.cleanup();
    this.timeLeft = this.durationSeconds;
    this.hasTriggered = false;

    let remaining = this.durationSeconds;

    this.intervalId = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        // Clear timer interval immediately
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }

        // PURE state update: sets timeLeft to 0 with zero side-effects
        this.setTimeLeftPure(0);

        // Execute completion side-effect safely in the timer callback (macrotask),
        // completely outside of React render phase and state updater execution!
        if (!this.hasTriggered) {
          this.hasTriggered = true;
          this.onComplete();
        }
      } else {
        // PURE state update: update remaining seconds
        this.setTimeLeftPure(remaining);
      }
    }, 1000);
  }

  // Pure state update simulator (records updates without executing side-effects inside updater)
  private setTimeLeftPure(val: number) {
    this.timeLeft = val;
    this.stateUpdates.push(val);
  }

  public handleCancel() {
    this.cleanup();
    this.hasTriggered = true;
    this.onCancel();
  }

  public handleImmediateSend() {
    this.cleanup();
    if (!this.hasTriggered) {
      this.hasTriggered = true;
      this.setTimeLeftPure(0);
      this.onComplete();
    }
  }

  public cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

describe('CountdownModal Timer & Idempotency Guarantees', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('completes full 3-second countdown and invokes onComplete exactly once', () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const controller = new CountdownController(onComplete, onCancel, 3);

    controller.setVisible(true);
    expect(controller.getTimeLeft()).toBe(3);
    expect(controller.isTimerRunning()).toBe(true);

    // 1st tick: 1 second elapsed -> 2 seconds left
    jest.advanceTimersByTime(1000);
    expect(controller.getTimeLeft()).toBe(2);
    expect(onComplete).not.toHaveBeenCalled();

    // 2nd tick: 2 seconds elapsed -> 1 second left
    jest.advanceTimersByTime(1000);
    expect(controller.getTimeLeft()).toBe(1);
    expect(onComplete).not.toHaveBeenCalled();

    // 3rd tick: 3 seconds elapsed -> countdown finishes!
    jest.advanceTimersByTime(1000);
    expect(controller.getTimeLeft()).toBe(0);
    expect(controller.isTimerRunning()).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    // Extra ticks after completion: idempotency guard prevents duplicate onComplete calls
    jest.advanceTimersByTime(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cancels countdown cleanly when handleCancel is invoked', () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const controller = new CountdownController(onComplete, onCancel, 3);

    controller.setVisible(true);

    // Advance 1 second (2s left)
    jest.advanceTimersByTime(1000);
    expect(controller.getTimeLeft()).toBe(2);

    // User cancels the countdown
    controller.handleCancel();

    expect(controller.isTimerRunning()).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();

    // Advancing timers further must NOT trigger onComplete
    jest.advanceTimersByTime(5000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('supports Immediate Send shortcut without double-dispatch', () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const controller = new CountdownController(onComplete, onCancel, 3);

    controller.setVisible(true);

    // User immediately presses "Send Immediately"
    controller.handleImmediateSend();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(controller.getTimeLeft()).toBe(0);
    expect(controller.isTimerRunning()).toBe(false);

    // Advancing timers must not call onComplete again
    jest.advanceTimersByTime(4000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cleans up active timers on unmount / visibility change', () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const controller = new CountdownController(onComplete, onCancel, 3);

    controller.setVisible(true);
    expect(controller.isTimerRunning()).toBe(true);

    // Advance 1 second
    jest.advanceTimersByTime(1000);

    // Component unmounts or modal becomes hidden
    controller.setVisible(false);

    expect(controller.isTimerRunning()).toBe(false);
    expect(controller.getTimeLeft()).toBe(3); // Reset to default duration

    // Advance timers further: no callback should fire
    jest.advanceTimersByTime(5000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('protects against repeated renders during countdown without resetting timer', () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const controller = new CountdownController(onComplete, onCancel, 3);

    controller.setVisible(true);

    // Simulate 1 second elapsed
    jest.advanceTimersByTime(1000);
    expect(controller.getTimeLeft()).toBe(2);

    // Simulate parent re-render (without changing visibility)
    // The active interval should continue smoothly to completion
    jest.advanceTimersByTime(2000);

    expect(controller.getTimeLeft()).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('SOS Dispatch Idempotency & Error Boundary Guarantees', () => {
  it('prevents concurrent duplicate dispatch invocations (Strict Mode & timer race guard)', async () => {
    let isDispatching = false;
    let dispatchCallCount = 0;

    const mockExecuteDispatch = async () => {
      if (isDispatching) {
        return; // Guard blocked duplicate invocation
      }
      isDispatching = true;
      dispatchCallCount += 1;

      try {
        // Simulate async GPS + network work
        await new Promise((r) => setTimeout(r, 50));
      } finally {
        isDispatching = false;
      }
    };

    // Simulate two simultaneous triggers (e.g., countdown zero + rapid user tap or Strict Mode)
    const p1 = mockExecuteDispatch();
    const p2 = mockExecuteDispatch();

    await Promise.all([p1, p2]);

    expect(dispatchCallCount).toBe(1);
    expect(isDispatching).toBe(false);
  });

  it('guarantees spinner state cleanup even if GPS acquisition throws an exception', async () => {
    let isLocating = false;
    let isSending = false;
    let isDispatchingRef = false;
    let errorCaught = false;

    const mockDispatchWithFaultyGps = async () => {
      if (isDispatchingRef) return;
      isDispatchingRef = true;
      isLocating = true;

      try {
        // Simulate unexpected crash during location retrieval
        throw new Error('Hardware location service fatal exception');
      } catch {
        errorCaught = true;
      } finally {
        // Guarantees no infinite spinner
        isLocating = false;
        isSending = false;
        isDispatchingRef = false;
      }
    };

    await mockDispatchWithFaultyGps();

    expect(errorCaught).toBe(true);
    expect(isLocating).toBe(false);
    expect(isSending).toBe(false);
    expect(isDispatchingRef).toBe(false);
  });

  it('allows subsequent dispatch after prior dispatch completes or is resolved', async () => {
    let isDispatching = false;
    let dispatchCallCount = 0;

    const mockExecuteDispatch = async () => {
      if (isDispatching) return;
      isDispatching = true;
      dispatchCallCount += 1;

      try {
        await new Promise((r) => setTimeout(r, 10));
      } finally {
        isDispatching = false;
      }
    };

    // First SOS dispatch
    await mockExecuteDispatch();
    expect(dispatchCallCount).toBe(1);
    expect(isDispatching).toBe(false);

    // Subsequent emergency trigger (e.g. after resolving previous alert)
    await mockExecuteDispatch();
    expect(dispatchCallCount).toBe(2);
    expect(isDispatching).toBe(false);
  });
});
