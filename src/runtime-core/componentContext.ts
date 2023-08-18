//emit需要在props中找到对应的监听事件触发,注意instance的获取方式——bind
export function emit(instance, emitEvent, ...args) {
  const { $props } = instance;
  if (emitEvent) {
    let e = "on" + emitEvent[0].toUpperCase() + emitEvent.slice(1);
    $props[e] && $props[e](...args);
  }
}
