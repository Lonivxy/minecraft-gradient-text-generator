import { onMounted, onUnmounted } from "vue";

export const useInterval = (callback: () => void, delay: number) => {
  let timer: number | null = null;

  onMounted(() => {
    timer = window.setInterval(callback, delay);
  });

  onUnmounted(() => {
    if (timer !== null) {
      window.clearInterval(timer);
    }
  });
};
