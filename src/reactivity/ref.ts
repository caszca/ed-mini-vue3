// let obj = {
//     _value: 1,
//     get value() {
//         return this._value
//     },
//     set value(newVal) {
//         this._value = newVal
//     }
// }
// console.log(obj.value)
// obj.value = 2

import { is } from "../utils";
import { trackEffect, triggerEffect } from "./effect";
import { reactive } from "./reactive";

const enum REF_FLAGS {
  IS_REF = "__v_isRef",
}

class Ref {
  private _value: any;
  public dep;
  public __v_isRef: boolean = true;
  constructor(refValue) {
    //传入ref可能为一个对象，需要用reactive包裹
    this._value = convert(refValue);
    this.dep = new Set();
  }
  get value() {
    //收集依赖
    trackEffect(this.dep);
    return this._value;
  }

  set value(newValue) {
    if (!Object.is(this._value, newValue)) {
      //一个包含对象类型值的ref可以响应式替换整个对象
      //判断逻辑尚待：let o=ref(obj) ,o.value=obj  相同对象会触发依赖？
      //ref传入属性类型与后期修改value不一样会报错？obj->普通，普通->obj

      this._value = convert(newValue);
      //触发依赖
      triggerEffect(this.dep);
    }
  }
}

function convert(value) {
  return is(value) ? reactive(value) : value;
}

export function ref(value) {
  let refObj = new Ref(value);
  return refObj;
}

//Ref对象的判断与reactive对象不同，因为proxy代理对象get时会获取到key值，
//我们可以根据key值去判断，而ref的get只针对value,无法获取到其他的key值。
//所以直接在Ref对象中内置一个属性来判断是否为ref对象
export function isRef(raw) {
  return !!raw[REF_FLAGS.IS_REF];
}

export function unRef(raw) {
  return isRef(raw) ? raw.value : raw;
}

//作用：将ref对象解包
export function proxyRefs(raw) {
  return new Proxy(raw, {
    get(target, key, receiver) {
      return unRef(Reflect.get(target, key));
    },

    set(target, key, value, receiver) {
      if (isRef(Reflect.get(target, key)) && !isRef(value))
        return Reflect.set(target, key, ref(value));
      else return Reflect.set(target, key, value);
    },
  });
}
