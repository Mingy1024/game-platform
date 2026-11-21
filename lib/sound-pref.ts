/**
 * 全站共用的聲音設定，記在本機；瀏覽器不允許儲存時只記在這次瀏覽。
 * - muted：右上的喇叭鈕＋暫停選單「音效」，只關音效（預設有聲）
 * - musicOff：右上的音符鈕＋暫停選單「音樂」，只關背景音樂（預設開）
 *
 * 純邏輯，只在瀏覽器端呼叫；畫面層用 app/composables/store.ts 的 useStore 訂閱。
 */
export type Pref = {
  read(): boolean;
  write(value: boolean): void;
  subscribe(listener: () => void): () => void;
};

function createPref(key: string): Pref {
  const listeners = new Set<() => void>();
  let memory: boolean | null = null;

  function read(): boolean {
    if (memory !== null) return memory;
    try {
      memory = window.localStorage.getItem(key) === "1";
    } catch {
      memory = false;
    }
    return memory;
  }

  function write(value: boolean): void {
    memory = value;
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // 不能儲存時只在這次瀏覽有效
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // 其他分頁切換時也跟著更新
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      memory = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { read, write, subscribe };
}

export const mutedPref = createPref("gp:muted");
export const musicOffPref = createPref("gp:music-off");

export const readMuted = mutedPref.read;
export const setMuted = mutedPref.write;

export const readMusicOff = musicOffPref.read;
export const setMusicOff = musicOffPref.write;
