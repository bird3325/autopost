/**
 * Debugger Controller - Chrome Debugger API Wrapper
 * Handles low-level interactions like input simulation and dialog handling.
 */

class DebuggerController {
    constructor() {
        this.target = null;
    }

    /**
     * Attach debugger to a tab
     */
    async attach(tabId) {
        this.target = { tabId };
        try {
            await chrome.debugger.attach(this.target, "1.3");
            console.log(`Debugger attached to tab ${tabId}`);

            // Enable necessary domains
            await this.sendCommand('Page.enable');
            await this.sendCommand('DOM.enable');
            await this.sendCommand('Runtime.enable');

            // Handle dialogs automatically
            chrome.debugger.onEvent.addListener(this.onEvent.bind(this));

        } catch (error) {
            console.error('Failed to attach debugger:', error);
            throw error;
        }
    }

    /**
     * Detach debugger
     */
    async detach() {
        if (this.target) {
            try {
                await chrome.debugger.detach(this.target);
                console.log('Debugger detached');
            } catch (error) {
                // Ignore if already detached
            }
            this.target = null;
        }
    }

    /**
     * Send command to debugger
     */
    async sendCommand(method, params = {}) {
        if (!this.target) throw new Error('Debugger not attached');
        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand(this.target, method, params, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Handle debugger events
     */
    /**
     * Handle debugger events
     */
    onEvent(source, method, params) {
        if (method === 'Page.javascriptDialogOpening') {
            console.log('Dialog detected:', params.message);

            let accept = true;
            const message = params.message || '';

            // Tistory "Restore draft" (임시저장) -> Cancel (false) to start fresh
            // "작성 중인 글이 있습니다. 복구하시겠습니까?" etc.
            if (message.includes('임시저장') || message.includes('복구') || message.includes('restore')) {
                accept = false;
                console.log('Dismissing "Restore draft" dialog');
            } else {
                // Accept other dialogs (like "Switch to Markdown" warning)
                console.log('Accepting dialog');
            }

            this.sendCommand('Page.handleJavaScriptDialog', {
                accept: accept,
                promptText: ''
            }).catch(console.error);
        }
    }

    /**
     * Simulate mouse click
     */
    async simulateClick(selector) {
        const root = await this.sendCommand('DOM.getDocument');
        const nodeId = await this.sendCommand('DOM.querySelector', {
            nodeId: root.root.nodeId,
            selector: selector
        });

        if (!nodeId.nodeId) throw new Error(`Element not found: ${selector}`);

        const box = await this.sendCommand('DOM.getBoxModel', { nodeId: nodeId.nodeId });
        const content = box.model.content;
        const x = (content[0] + content[2]) / 2;
        const y = (content[1] + content[5]) / 2;

        await this.sendCommand('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: x,
            y: y,
            button: 'left',
            clickCount: 1
        });

        await new Promise(r => setTimeout(r, 50)); // Small delay

        await this.sendCommand('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: x,
            y: y,
            button: 'left',
            clickCount: 1
        });
    }

    /**
     * Simulate typing
     */
    async simulateType(selector, text) {
        // First click to focus
        try {
            await this.simulateClick(selector);
        } catch (e) {
            console.warn('Click failed before typing, attempting to type anyway:', e);
        }

        for (const char of text) {
            await this.sendCommand('Input.dispatchKeyEvent', {
                type: 'char',
                text: char
            });
            // Random delay for human-like typing
            await new Promise(r => setTimeout(r, Math.random() * 50 + 30));
        }
    }

    /**
     * Simulate single key press
     */
    async simulateKey(key) {
        // Map common keys to Windows virtual key codes if necessary, 
        // but 'rawKeyDown'/'keyUp' with 'key' parameter often works for modern Chrome.

        const definition = {
            'Enter': { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
            'Tab': { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
            'Escape': { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }
        }[key];

        if (!definition) {
            console.warn(`Key ${key} not mapped, trying generic dispatch`);
        }

        const params = definition || { key: key };

        await this.sendCommand('Input.dispatchKeyEvent', {
            type: 'rawKeyDown',
            ...params
        });

        await new Promise(r => setTimeout(r, 50));

        await this.sendCommand('Input.dispatchKeyEvent', {
            type: 'keyUp',
            ...params
        });
    }
}

// Singleton instance
const debuggerController = new DebuggerController();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = debuggerController;
}
