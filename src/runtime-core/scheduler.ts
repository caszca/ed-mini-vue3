//组件多次响应式数据多次改变时，用于缓存首次更新函数到队列中
const queue: any[] = [];
const p = Promise.resolve();
let pending = false; //用途:遍历队列函数只放入微任务队列一次
export function queueJobs(updateFn) {
  if (!queue.includes(updateFn)) {
    queue.push(updateFn);
  }
  queueFlush();
}

//负责执行微任务队列
function queueFlush() {
  if (pending) return;
  pending = true;
  p.then(() => {
    pending = false;
    while (queue.length) {
      const fn = queue.shift();
      fn();
    }
  });
}

export function nextTick(fn) {
  return fn ? p.then(fn) : p;
}
