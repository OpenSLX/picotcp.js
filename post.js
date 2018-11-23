// HACK: Work around <https://github.com/kripken/emscripten/issues/5820>.
const _Module = new Proxy(Module, {
    apply(target, thisArg, args) {
        return new Promise(resolve => Reflect.apply(target, thisArg, args)
            .then(m => {
                delete m.then;
                resolve(m);
            }));
    }
});
export { _Module as default };

class SyncWritableReadableStream extends ReadableStream {
    constructor(...args) {
        let controller;
        super({
            start: _controller => controller = _controller,
        }, ...args);
        this.controller = controller;
    }
    _write(...args) {
        this.controller.enqueue(...args);
    }
    _close() {
        if (this.isClosed) return;
        this.controller.close();
        this.isClosed = true;
    }
}

const EOF = Symbol("EOF");

class SyncSink {
    constructor({size = () => 1, highWaterMark = 1} = {}) {
        this._queue = [];
        this._queueTotalSize = 0;
        this._strategyHWM = highWaterMark;
        this._strategySizeAlgorithm = size;
        this._ready = Promise.resolve();
        this._readyResolve = () => {};
        this._readyReject = () => {};
        this._isAborted = false;
    }
    write(chunk, controller) {
        if (chunk === EOF) return;
        const size = this._strategySizeAlgorithm(chunk);
        this._queueTotalSize += size;
        this._queue.push([chunk, size]);
        if (this._queueTotalSize < this._strategyHWM) return;
        this._ready = new Promise((resolve, reject) => {
            this._readyResolve = resolve;
            this._readyReject = reject;
        });
        if (this._onData) {
            this._onData();
            this._onData = null;
        }
        return this._ready;
    }
    close() {
        this._queue.push([EOF, 0]);
    }
    abort(reason) {
        this._isAborted = reason;
        this._queue = [];
    }
    read() {
        if (this._queue.length === 0) return [];
        const [chunk, size] = this._queue.shift();
        this._queueTotalSize -= size;
        if (this._queueTotalSize < 0) this._queueTotalSize = 0;
        if (this._queueTotalSize < this._strategyHWM) this._readyResolve();
        return [chunk];
    }
}

class SyncReadableWritableStream extends WritableStream {
    constructor(sinkArgs, ...args) {
        const sink = new SyncSink(sinkArgs);
        super(sink, ...args);
        this._sink = sink;
    }
    _read() {
        return this._sink.read()[0];
    }
    get EOF() {
        return EOF;
    }
    get isAborted() {
        return this._sink.isAborted;
    }
    get ready() {
        return this._sink._ready;
    }
    set _onData(val) {
        this._sink._onData = val;
    }
    *[Symbol.iterator]() {
        for (let v; v = this._sink.read();) {
            if (v.length === 0) break;
            yield v[0];
        }
    }
}
