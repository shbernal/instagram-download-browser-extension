import './index.scss';

import { CONFIG_LIST, DEFAULT_DATETIME_FORMAT, DEFAULT_FILENAME_FORMAT } from '../constants';

// Settings whose stored value is undefined until first toggled, but should read as on.
const DEFAULT_ON = new Set(['setting_enable_explore_video_clickthrough']);
const TEXT_DEFAULTS: Record<string, string> = {
   setting_format_filename: DEFAULT_FILENAME_FORMAT,
   setting_format_datetime: DEFAULT_DATETIME_FORMAT,
};

if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
   document.querySelector('main')!.classList.add('mobile');
}

const datetimeGroup = document.getElementById('datetime-format-group')!;
const datetimeToggle = document.getElementById('setting_enable_datetime_format') as HTMLInputElement;
const syncDatetimeGroup = () => (datetimeGroup.hidden = !datetimeToggle.checked);

const settings = await chrome.storage.sync.get(CONFIG_LIST);

for (const key of CONFIG_LIST) {
   const input = document.getElementById(key) as HTMLInputElement | null;
   if (!input) continue;

   if (input.type === 'checkbox') {
      input.checked = DEFAULT_ON.has(key) ? (settings[key] ?? true) : !!settings[key];
      input.addEventListener('change', () => chrome.storage.sync.set({ [key]: input.checked }));
   } else {
      const fallback = TEXT_DEFAULTS[key];
      input.value = (settings[key] as string) || fallback;
      input.addEventListener('input', () => chrome.storage.sync.set({ [key]: input.value || fallback }));
   }
}

syncDatetimeGroup();
datetimeToggle.addEventListener('change', syncDatetimeGroup);
