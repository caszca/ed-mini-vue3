import { h, renderSlots } from "../../lib/guide-mini-vue.esm.js";

export default {
  setup(props, { emit }) {},
  render() {
    const fff = h("div", {}, "foo");
    const foo = renderSlots(this.$slots);
    return h("div", {}, [
      renderSlots(this.$slots, "header"),
      fff,
      renderSlots(this.$slots, "footer"),
    ]);
  },
};
