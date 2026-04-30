import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingsPage } from '../AppSettingsPage';
import {
  applyPan,
  applyPinch,
  clampScale,
  createCroppedIconDataUrl,
} from '../AppIconEditorPage';
import { SettingsApp } from '../../SettingsApp';
import { useSettingsNavStore } from '../../settingsNavStore';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import {
  calculateAllAppStorageUsage,
  calculateAppStorageUsage,
} from '@/platform/storage/calculateAppStorageUsage';

vi.mock('@/platform/storage/calculateAppStorageUsage', () => ({
  calculateAllAppStorageUsage: vi.fn(),
  calculateAppStorageUsage: vi.fn(),
}));

const calculateAllAppStorageUsageMock = vi.mocked(calculateAllAppStorageUsage);
const calculateAppStorageUsageMock = vi.mocked(calculateAppStorageUsage);
let canvasMock: ReturnType<typeof mockCanvas2d> | null = null;

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,UPLOADED_ICON`;
    queueMicrotask(() => this.onload?.());
  }
}

class MockImage {
  naturalWidth = 1024;
  naturalHeight = 512;
  width = 1024;
  height = 512;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private source = '';

  set src(value: string) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }

  get src() {
    return this.source;
  }
}

function mockCanvas2d() {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
  };
  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((contextId: string) =>
      contextId === '2d'
        ? (context as unknown as CanvasRenderingContext2D)
        : null,
    );
  const toDataURLSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/jpeg;base64,CROPPED_ICON');

  return {
    context,
    getContextSpy,
    toDataURLSpy,
    restore: () => {
      getContextSpy.mockRestore();
      toDataURLSpy.mockRestore();
    },
  };
}

function installImageMocks() {
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal('FileReader', MockFileReader);
}

function mockUsageFor(appId: string) {
  if (appId === 'safari') {
    return {
      appId,
      appBytes: 4096,
      dataBytes: 1024,
      totalBytes: 5120,
    };
  }

  return {
    appId,
    appBytes: appId === 'todo-app' ? 2048 : 0,
    dataBytes: 0,
    totalBytes: appId === 'todo-app' ? 2048 : 0,
  };
}

function renderSettingsAppAtAppDetail(appId: string) {
  useSettingsNavStore.getState().push('apps');
  useSettingsNavStore.getState().push({
    page: 'appDetail',
    params: { appId },
  });
  render(<SettingsApp />);
}

describe('AppSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsNavStore.getState().reset();
    useAppProfileStore.setState({ profiles: {} });
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      appOrigin: { x: 0, y: 0, width: 60, height: 60 },
    });
    calculateAllAppStorageUsageMock.mockImplementation(async (appIds) =>
      Object.fromEntries(appIds.map((appId) => [appId, mockUsageFor(appId)])),
    );
    calculateAppStorageUsageMock.mockImplementation(async (appId) =>
      mockUsageFor(appId),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    canvasMock?.restore();
    canvasMock = null;
  });

  it('clamps scale and keeps pan inside the square crop bounds', () => {
    const crop = {
      sourceWidth: 1024,
      sourceHeight: 512,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    };

    expect(clampScale(0.25)).toBe(1);
    expect(clampScale(10)).toBe(5);
    expect(clampScale(2.2)).toBe(2.2);
    expect(applyPan(crop, 80, 40)).toMatchObject({
      offsetX: 80,
      offsetY: 0,
    });
    expect(applyPan(crop, 999, 0).offsetX).toBe(256);
  });

  it('pinches around an explicit next scale and preserves the anchor point', () => {
    const crop = {
      sourceWidth: 1024,
      sourceHeight: 512,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    };

    const pinched = applyPinch(crop, {
      previousCenterX: 100,
      previousCenterY: 0,
      nextCenterX: 100,
      nextCenterY: 0,
      nextScale: 2,
    });

    expect(pinched.scale).toBe(2);
    expect(pinched.offsetX).toBe(-100);
    expect(pinched.offsetY).toBe(0);
  });

  it('draws the cropped icon with the same cover and offset semantics as preview', async () => {
    installImageMocks();
    canvasMock = mockCanvas2d();

    const result = await createCroppedIconDataUrl(
      'data:image/png;base64,SOURCE',
      {
        sourceWidth: 1024,
        sourceHeight: 512,
        scale: 1.5,
        offsetX: 20,
        offsetY: -10,
      },
    );

    expect(result).toBe('data:image/jpeg;base64,CROPPED_ICON');
    expect(canvasMock.context.clearRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(canvasMock.context.fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(canvasMock.context.drawImage).toHaveBeenCalledTimes(1);
    const drawCall = canvasMock.context.drawImage.mock.calls[0]!;
    expect(drawCall[1]).toBeCloseTo(-492);
    expect(drawCall[2]).toBeCloseTo(-138);
    expect(drawCall[3]).toBeCloseTo(1536);
    expect(drawCall[4]).toBeCloseTo(768);
    expect(canvasMock.toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.82);
  });

  it('groups system, preinstalled, and user installed apps', async () => {
    useInstalledUserAppsStore.getState().replaceAll([
      {
        id: 'todo-app',
        name: '待办',
        iconDataUrl: null,
        page: 1,
        perspectiveAware: false,
        version: '1.0.0',
        installedAt: 1,
        sizeBytes: 2048,
      },
    ]);

    render(<AppSettingsPage />);

    expect(await screen.findByText('系统 App')).toBeInTheDocument();
    expect(screen.getByText('预装 App')).toBeInTheDocument();
    expect(screen.getByText('用户安装 App')).toBeInTheDocument();
    expect(screen.getByText('设置')).toBeInTheDocument();
    expect(screen.getByText('五子棋')).toBeInTheDocument();
    expect(screen.getByText('待办')).toBeInTheDocument();
    expect(screen.queryByText('2.0 KB')).not.toBeInTheDocument();
    expect(calculateAllAppStorageUsageMock).not.toHaveBeenCalled();
  });

  it('searches by custom name, original name, and app id', async () => {
    useAppProfileStore.getState().setName('safari', '网页');
    render(<AppSettingsPage />);

    const search = screen.getByTestId('app-settings-search');
    await userEvent.type(search, '网页');
    expect(screen.getByText('网页')).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'Safari');
    expect(screen.getByText('网页')).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'gomoku');
    expect(screen.getByText('五子棋')).toBeInTheDocument();
  });

  it('refreshes the app settings row icon when the app profile icon changes', async () => {
    render(<AppSettingsPage />);

    const row = await screen.findByTestId('app-settings-row-safari');
    const icon = row.querySelector('img');
    expect(icon).toHaveAttribute('src', '/resource/icons/ios-system/safari.jpg');

    act(() => {
      useAppProfileStore.getState().setIcon('safari', {
        dataUrl: 'data:image/jpeg;base64,NEW_ICON',
        crop: {
          sourceWidth: 512,
          sourceHeight: 512,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        },
      });
    });

    await waitFor(() => {
      expect(row.querySelector('img')).toHaveAttribute(
        'src',
        'data:image/jpeg;base64,NEW_ICON',
      );
    });
  });

  it('opens the app detail page in SettingsApp instead of falling back home', async () => {
    render(<SettingsApp />);

    await userEvent.click(screen.getByTestId('list-row-App'));
    expect(await screen.findByTestId('app-settings-page')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('app-settings-row-safari'));

    expect(await screen.findByTestId('app-detail-page')).toBeInTheDocument();
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveTextContent('Safari');
  });

  it('opens the app detail route with the app id param', async () => {
    render(<AppSettingsPage />);

    await userEvent.click(screen.getByTestId('app-settings-row-safari'));

    const stack = useSettingsNavStore.getState().stack;
    expect(stack[stack.length - 1]).toEqual({
      page: 'appDetail',
      params: { appId: 'safari' },
    });
  });

  it('navigates from Settings home to the App list page', async () => {
    render(<SettingsApp />);

    await userEvent.click(screen.getByTestId('list-row-App'));

    expect(await screen.findByTestId('app-settings-page')).toBeInTheDocument();
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveTextContent('App');
    await waitFor(() => {
      expect(screen.getByText('系统 App')).toBeInTheDocument();
    });
  });

  it('edits the display name and restores the default profile', async () => {
    renderSettingsAppAtAppDetail('safari');

    const nameInput = await screen.findByTestId('app-detail-name-input');
    expect(nameInput).toHaveValue('Safari');

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, '网页');
    await userEvent.click(screen.getByTestId('app-detail-save-name'));

    await waitFor(() => {
      expect(screen.getByTestId('app-detail-name-input')).toHaveValue('网页');
    });
    expect(
      useAppProfileStore.getState().getProfile('safari')?.customName,
    ).toBe('网页');

    await userEvent.click(screen.getByTestId('app-detail-restore-default'));

    await waitFor(() => {
      expect(screen.getByTestId('app-detail-name-input')).toHaveValue('Safari');
    });
    expect(useAppProfileStore.getState().getProfile('safari')).toBeUndefined();
  });

  it('shows read-only storage rows without a clear action', async () => {
    renderSettingsAppAtAppDetail('safari');

    expect(await screen.findByText('App 大小')).toBeInTheDocument();
    expect(screen.getByText('文稿与数据')).toBeInTheDocument();
    expect(screen.getByText('总占用')).toBeInTheDocument();
    expect(await screen.findByText('4.0 KB')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('5.0 KB')).toBeInTheDocument();
    expect(screen.queryByText(/清空/)).not.toBeInTheDocument();
  });

  it('shows built-in storage copy instead of a dash when size is unknown', async () => {
    renderSettingsAppAtAppDetail('calendar');

    expect(await screen.findByText('App 大小')).toBeInTheDocument();
    expect(screen.getAllByText('内置')).toHaveLength(2);
    expect(screen.getByText('0 B')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('shows an empty state when the app id is missing', async () => {
    useSettingsNavStore.getState().push({ page: 'appDetail' });
    render(<SettingsApp />);

    expect(await screen.findByTestId('app-detail-empty')).toHaveTextContent(
      'App 不存在',
    );
  });

  it('pushes the app icon editor route with the current app id', async () => {
    renderSettingsAppAtAppDetail('safari');

    await userEvent.click(await screen.findByTestId('app-detail-edit-icon'));

    const stack = useSettingsNavStore.getState().stack;
    expect(stack[stack.length - 1]).toEqual({
      page: 'appIconEditor',
      params: { appId: 'safari' },
    });
  });

  it('renders the app icon editor route from the detail page in SettingsApp', async () => {
    render(<SettingsApp />);

    await userEvent.click(screen.getByTestId('list-row-App'));
    await userEvent.click(await screen.findByTestId('app-settings-row-safari'));
    await userEvent.click(await screen.findByTestId('app-detail-edit-icon'));

    expect(await screen.findByTestId('app-icon-editor-page')).toBeInTheDocument();
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveTextContent('编辑图标');
  });

  it('shows an empty state when the icon editor app id is missing', async () => {
    useSettingsNavStore.getState().push({ page: 'appIconEditor' });
    render(<SettingsApp />);

    expect(await screen.findByTestId('app-icon-editor-empty')).toHaveTextContent(
      'App 不存在',
    );
  });

  it('shows the icon editing panel and size after selecting an image', async () => {
    installImageMocks();
    useSettingsNavStore.getState().push({
      page: 'appIconEditor',
      params: { appId: 'safari' },
    });

    render(<SettingsApp />);

    expect(await screen.findByTestId('app-icon-current-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('app-icon-editing-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-icon-save')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('app-icon-upload'), {
      target: {
        files: [new File(['icon-bytes'], 'wide.png', { type: 'image/png' })],
      },
    });

    expect(await screen.findByTestId('app-icon-editing-panel')).toBeInTheDocument();
    expect(screen.getByText('图标大小')).toBeInTheDocument();
    expect(screen.getByText('512 x 512')).toBeInTheDocument();
    expect(screen.getByText('原图尺寸')).toBeInTheDocument();
    expect(screen.getByText('1024 x 512')).toBeInTheDocument();
    expect(screen.getByText('原图大小')).toBeInTheDocument();
    expect(screen.getByText('10 B')).toBeInTheDocument();
    expect(screen.getByText('缩放')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByTestId('app-icon-save')).toBeInTheDocument();
  });

  it('keeps the selected image when the initial icon decode finishes later', async () => {
    let initialImage: { onload: (() => void) | null } | null = null;

    class RaceFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,${file.name}`;
        queueMicrotask(() => this.onload?.());
      }
    }

    class InitialRaceImage {
      naturalWidth = 1024;
      naturalHeight = 512;
      width = 1024;
      height = 512;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private source = '';

      set src(value: string) {
        this.source = value;
        if (value.includes('/resource/icons/ios-system/safari.jpg')) {
          initialImage = this;
          return;
        }
        queueMicrotask(() => this.onload?.());
      }

      get src() {
        return this.source;
      }
    }

    vi.stubGlobal('Image', InitialRaceImage);
    vi.stubGlobal('FileReader', RaceFileReader);
    useSettingsNavStore.getState().push({
      page: 'appIconEditor',
      params: { appId: 'safari' },
    });

    render(<SettingsApp />);

    fireEvent.change(await screen.findByTestId('app-icon-upload'), {
      target: {
        files: [new File(['upload'], 'upload.png', { type: 'image/png' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('app-icon-preview-image')).toHaveAttribute(
        'src',
        'data:image/png;base64,upload.png',
      );
    });

    const delayedInitialImage = initialImage as
      | { onload: (() => void) | null }
      | null;
    delayedInitialImage?.onload?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('app-icon-preview-image')).toHaveAttribute(
      'src',
      'data:image/png;base64,upload.png',
    );
  });

  it('uploads an image inside React StrictMode', async () => {
    installImageMocks();
    useSettingsNavStore.getState().push({
      page: 'appIconEditor',
      params: { appId: 'safari' },
    });

    render(
      <StrictMode>
        <SettingsApp />
      </StrictMode>,
    );

    fireEvent.change(await screen.findByTestId('app-icon-upload'), {
      target: {
        files: [new File(['strict'], 'strict.png', { type: 'image/png' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('app-icon-preview-image')).toHaveAttribute(
        'src',
        'data:image/png;base64,UPLOADED_ICON',
      );
    });
  });

  it('uploads an image and saves the cropped icon profile', async () => {
    installImageMocks();
    canvasMock = mockCanvas2d();
    useSettingsNavStore.getState().push({
      page: 'appIconEditor',
      params: { appId: 'safari' },
    });

    render(<SettingsApp />);

    const file = new File(['icon-bytes'], 'wide.png', { type: 'image/png' });
    fireEvent.change(await screen.findByTestId('app-icon-upload'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('app-icon-preview-image')).toHaveAttribute(
        'src',
        'data:image/png;base64,UPLOADED_ICON',
      );
    });

    const cropArea = screen.getByTestId('app-icon-crop-area');
    fireEvent.pointerDown(cropArea, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(cropArea, {
      pointerId: 1,
      clientX: 130,
      clientY: 110,
    });
    fireEvent.pointerUp(cropArea, {
      pointerId: 1,
      clientX: 130,
      clientY: 110,
    });
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      clientX: 130,
      clientY: 110,
      bubbles: true,
      cancelable: true,
    });
    cropArea.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByTestId('app-icon-save'));

    await waitFor(() => {
      expect(
        useAppProfileStore.getState().getProfile('safari')?.customIconDataUrl,
      ).toBe('data:image/jpeg;base64,CROPPED_ICON');
    });
    const profile = useAppProfileStore.getState().getProfile('safari');
    expect(profile?.iconCrop).toMatchObject({
      sourceWidth: 1024,
      sourceHeight: 512,
    });
    expect(profile?.iconCrop?.scale).toBeGreaterThan(1);
    expect(profile?.iconCrop?.offsetX).toBeGreaterThan(0);
    expect(screen.getByTestId('app-icon-save-status')).toHaveTextContent(
      '已保存',
    );
    await waitFor(() => {
      expect(screen.getByTestId('app-icon-preview-image')).toHaveAttribute(
        'src',
        'data:image/jpeg;base64,CROPPED_ICON',
      );
    });
  });

  it('keeps the latest icon upload when an earlier decode finishes later', async () => {
    let firstImage: { onload: (() => void) | null } | null = null;

    class RaceFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(file: File) {
        this.result = `data:image/png;base64,${file.name}`;
        queueMicrotask(() => this.onload?.());
      }
    }

    class RaceImage {
      naturalWidth = 1024;
      naturalHeight = 512;
      width = 1024;
      height = 512;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private source = '';

      set src(value: string) {
        this.source = value;
        if (value.includes('first.png')) {
          firstImage = this;
          return;
        }
        queueMicrotask(() => this.onload?.());
      }

      get src() {
        return this.source;
      }
    }

    vi.stubGlobal('Image', RaceImage);
    vi.stubGlobal('FileReader', RaceFileReader);
    useSettingsNavStore.getState().push({
      page: 'appIconEditor',
      params: { appId: 'safari' },
    });

    render(<SettingsApp />);

    const upload = await screen.findByTestId('app-icon-upload');
    fireEvent.change(upload, {
      target: {
        files: [new File(['first'], 'first.png', { type: 'image/png' })],
      },
    });
    fireEvent.change(upload, {
      target: {
        files: [new File(['second'], 'second.png', { type: 'image/png' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('app-icon-preview-image')).toHaveAttribute(
        'src',
        'data:image/png;base64,second.png',
      );
    });

    const delayedFirstImage = firstImage as
      | { onload: (() => void) | null }
      | null;
    delayedFirstImage?.onload?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('app-icon-preview-image')).toHaveAttribute(
      'src',
      'data:image/png;base64,second.png',
    );
  });
});
