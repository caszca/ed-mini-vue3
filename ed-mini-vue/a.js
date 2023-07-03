const i = 123
const a = { name: 123 }
function foo({ name: i }) {
    console.log(i)
}
foo(a)