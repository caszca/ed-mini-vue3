export const extend = Object.assign

export function is(target) {
    return target != null && typeof target == 'object'
}