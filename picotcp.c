#include <time.h>
#include "pico_stack.h"
#include "pico_ipv4.h"
#include "pico_icmp4.h"
#include "pico_device.h"
#include "pico_socket.h"
#include <emscripten.h>

static int pico_js_send(struct pico_device *dev, void *buf, int len) {
    if (EM_ASM_DOUBLE(return Module.pointers[$0].readable.desiredSize, dev) <= 0) {
        return 0;
    }
    EM_ASM(
        // Depending on browser's implementation, this might have better or worse performance than:
        Module.pointers[$0].readable._write(HEAPU8.slice($1, $1 + $2)),
        // Module.pointers[$0].readable._write(new Blob([HEAPU8.subarray($1, $1 + $2)])),
        dev, buf, len
    );
    return len;
}

static int pico_js_poll(struct pico_device *dev, int loop_score) {
    while (loop_score > 0) {
        size_t size = (size_t) EM_ASM_INT((
            const device = Module.pointers[$0];
            const buffer = device.writable._read();
            if (!buffer) return 0;
            Module._readBuffer = buffer;
            return buffer.byteLength;
        ), dev);
        if (!size) break;
        // Alternative:
        // Module._pico_js_zalloc(buffer.byteLength);
        // void *pico_js_zalloc(size_t len) {
        //     return PICO_ZALLOC(len);
        // }
        uint8_t *buf = PICO_ZALLOC(size);
        EM_ASM((
            writeArrayToMemory(Module._readBuffer, $0);
            Module._readBuffer = null;
        ), buf);
        pico_stack_recv_zerocopy(dev, buf, size);
        loop_score--;
    }
    return loop_score;
}

int EMSCRIPTEN_KEEPALIVE js_pico_err(void) {
    return pico_err;
}

int EMSCRIPTEN_KEEPALIVE js_socket_connect(struct pico_socket *s, const char *remote_addr, uint16_t remote_port) {
    struct pico_ip4 addr;
    pico_string_to_ipv4(remote_addr, &addr.addr);
    return pico_socket_connect(s, &addr, short_be(remote_port));
}

int EMSCRIPTEN_KEEPALIVE js_socket_bind(struct pico_socket *s, const char *remote_addr, uint16_t port) {
    struct pico_ip4 addr;
    port = short_be(port);
    pico_string_to_ipv4(remote_addr, &addr.addr);
    pico_socket_bind(s, &addr, &port);
    return pico_socket_listen(s, 10);
}

static void js_wakeup(uint16_t ev, struct pico_socket *s) {
    char buf[1024];
    int len;
    if (ev & PICO_SOCK_EV_CONN) {
        if (s->number_of_pending_conn) {
            struct pico_ip4 orig = {0};
            uint16_t port = 0;
            struct pico_socket *client_sock = pico_socket_accept(s, &orig, &port);
            EM_ASM((
                Module.pointers[$0] = {
                    writable: new SyncReadableWritableStream(),
                    readable: new SyncWritableReadableStream(),
                    remoteIP: $1,
                    remotePort: $2,
                };
                Module.pointers[$3].readable._write(Module.pointers[$0]);
            ), client_sock, orig, port, s);
        }
    }
    switch (0) { default:
    if (ev & PICO_SOCK_EV_RD) {
        len = pico_socket_read(s, buf, sizeof(buf));
        if (len < 0) {
            EM_ASM((Module.pointers[$0].readable.error();), s);
            break;
        }
        EM_ASM((Module.pointers[$0].readable._write(HEAPU8.slice($1, $1 + $2));), s, buf, len);
    }
    if (ev & PICO_SOCK_EV_WR) {
        size_t size = EM_ASM_INT((
            const device = Module.pointers[$0];
            const buffer = device.writable._read();
            if (buffer === device.writable.EOF) return -1;
            if (!buffer) device.writable._onData = () => {
                Module._js_wakeup($1, $0);
            };
            if (!buffer) return 0;
            Module._readBuffer = buffer;
            return buffer.byteLength;
        ), s, PICO_SOCK_EV_WR);
        if (!size) break;
        if (size == -1) {
            pico_socket_shutdown(s, PICO_SHUT_WR);
            break;
        }
        // TODO: Stream should be preprocessed to only contain < MTU chunks.
        uint8_t *buf2 = PICO_ZALLOC(size);
        EM_ASM((
            writeArrayToMemory(Module._readBuffer, $0);
        ), buf2);
        len = pico_socket_write(s, buf2, size);
        // HACK: We need to put back bytes we could not write!
        EM_ASM((
           const _unread = (reader, value) => {
             reader._read = new Proxy(reader._read, {
               apply(target, thisArg, args) {
                 thisArg._read = target;
                 return value;
               }
             });
           };

           const device = Module.pointers[$0];
           if ($1 < Module._readBuffer.byteLength) {
             _unread(device.writable, Module._readBuffer.subarray($1));
           }
           Module._readBuffer = null;
        ), s, len);
        PICO_FREE(buf2);
    }
    if (ev & PICO_SOCK_EV_FIN) {
        EM_ASM((Module.pointers[$0].readable._close();), s);
    }
    }
}

struct pico_socket EMSCRIPTEN_KEEPALIVE *js_socket_open(uint16_t net, uint16_t proto) {
    struct pico_socket *s = pico_socket_open(net, proto, js_wakeup);
    EM_ASM((
        Module.pointers[$0] = {
            writable: new SyncReadableWritableStream(),
            readable: new SyncWritableReadableStream(),
        };
    ), s);
    return s;
}

struct pico_device *pico_js_create(char *name, uint8_t mac[8]) {
    struct pico_device *dev = PICO_ZALLOC(sizeof(struct pico_device));
    EM_ASM((
        Module.pointers[$0] = {
            name: UTF8ToString($1),
            writable: new SyncReadableWritableStream(),
            readable: new SyncWritableReadableStream(),
        };
    ), dev, name);
    pico_device_init(dev, name, mac);
    dev->send = pico_js_send;
    dev->poll = pico_js_poll;
    return dev;
}

struct pico_device EMSCRIPTEN_KEEPALIVE *create_dev_js(char *ip) {
    struct pico_ip4 ipaddr, netmask;
    struct pico_device *dev;

}

int js_add_ipv4(struct pico_device *dev, char *ip, char *net) {
    struct pico_ip4 ipaddr, netmask;
    pico_string_to_ipv4(ip, &ipaddr.addr);
    pico_string_to_ipv4(net, &netmask.addr);
    return pico_ipv4_link_add(dev, ipaddr, netmask);
}

int main(void){
    int id;
    struct pico_ip4 ipaddr, netmask;
    struct pico_device* dev;

    EM_ASM((
        Module._readBuffer = null;
        Module.pointers = {};
    ));

    pico_stack_init();
    return 0;
}
