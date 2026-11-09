import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
})
Object.defineProperty(globalThis, 'window', {
  value: dom.window,
  configurable: true,
})
Object.defineProperty(globalThis, 'document', {
  value: dom.window.document,
  configurable: true,
})
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
})
Object.defineProperty(globalThis, 'HTMLElement', {
  value: dom.window.HTMLElement,
  configurable: true,
})
Object.defineProperty(globalThis, 'HTMLDialogElement', {
  value: dom.window.HTMLDialogElement,
  configurable: true,
})
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  value: true,
  writable: true,
})
// Browser modal behavior is covered by Playwright; JSDOM needs the native methods.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false
}

Object.defineProperty(globalThis, 'localStorage', {
  value: dom.window.localStorage,
  configurable: true,
})
