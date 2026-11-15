/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import {
  NeuralLoader,
  NeuralWatermark,
  RouteLoader,
  AppBootGuard,
} from '../../presentation/components/common/loaders';

describe('Neural Intro Splash & Route Watermark System', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it('renders NeuralLoader intro presentation with CIOB GMAO branding and triggers onComplete once on skip', () => {
    const onComplete = vi.fn();

    act(() => {
      root.render(
        <NeuralLoader
          mode="fullscreen"
          appName="CIOB"
          appAccent="GMAO NEXUS"
          onComplete={onComplete}
        />
      );
    });

    expect(container.textContent).toContain('CIOB');
    expect(container.textContent).toContain('GMAO NEXUS');
    expect(container.textContent).toContain('Passer l');

    const skipButton = container.querySelector('button[type="button"]') as HTMLButtonElement;
    expect(skipButton).toBeTruthy();

    act(() => {
      skipButton.click();
      skipButton.click();
      vi.advanceTimersByTime(350);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('auto-completes NeuralLoader stages cleanly and invokes onComplete', async () => {
    const onComplete = vi.fn();

    act(() => {
      root.render(<NeuralLoader mode="section" onComplete={onComplete} />);
    });

    for (let step = 0; step < 8; step++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('AppBootGuard presents NeuralLoader first and transitions to operational SplashScreen child after skip', () => {
    act(() => {
      root.render(
        <AppBootGuard>
          <div data-testid="real-ssot-splash">SSOT Manifest Splash Operational</div>
        </AppBootGuard>
      );
    });

    expect(container.querySelector('[data-testid="real-ssot-splash"]')).toBeNull();
    expect(container.textContent).toContain('CIOB');

    const skipBtn = container.querySelector('button[type="button"]') as HTMLButtonElement;
    act(() => {
      skipBtn.click();
      vi.advanceTimersByTime(350);
    });

    expect(container.querySelector('[data-testid="real-ssot-splash"]')?.textContent).toBe(
      'SSOT Manifest Splash Operational'
    );
  });

  it('renders RouteLoader with 40% translucent skeleton layer and NeuralWatermark', () => {
    act(() => {
      root.render(<RouteLoader currentTab="dashboard" label="Chargement..." />);
    });

    const translucentWrapper = container.querySelector('.opacity-40');
    expect(translucentWrapper).toBeTruthy();

    const statusNode = container.querySelector('[role="status"]');
    expect(statusNode).toBeTruthy();
    expect(container.textContent).toContain('Chargement...');
  });

  it('renders standalone NeuralWatermark cleanly', () => {
    act(() => {
      root.render(<NeuralWatermark />);
    });

    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
