import { h, renderSlots } from "../../lib/guide-mini-vue.esm.js";

export default {
  setup(props, { emit }) {},
  render() {
    const foo = renderSlots(this.$slots);
    return h("div", {}, [foo]);
  },
};
