/**
 * Crypto - 크리덴셜 암호화/복호화
 * WebCrypto API를 사용한 안전한 데이터 암호화
 */

class Crypto {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
    }

    /**
     * 암호화 키 생성
     */
    async generateKey() {
        return await crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 키를 저장 가능한 형태로 내보내기
     */
    async exportKey(key) {
        const exported = await crypto.subtle.exportKey('raw', key);
        return this.arrayBufferToBase64(exported);
    }

    /**
     * 저장된 키 가져오기
     */
    async importKey(keyData) {
        const rawKey = this.base64ToArrayBuffer(keyData);
        return await crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: this.algorithm },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * 데이터 암호화
     */
    async encrypt(text, key) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        // IV (Initialization Vector) 생성
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await crypto.subtle.encrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            data
        );

        // IV와 암호화된 데이터를 함께 저장
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return this.arrayBufferToBase64(combined.buffer);
    }

    /**
     * 데이터 복호화
     */
    async decrypt(encryptedText, key) {
        const combined = this.base64ToArrayBuffer(encryptedText);

        // IV 추출
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    /**
     * 간단한 암호화 (extension ID 기반)
     * 주의: 이것은 완벽한 보안을 제공하지 않습니다.
     * 실제 프로덕션에서는 더 강력한 키 관리가 필요합니다.
     */
    async simpleEncrypt(text) {
        try {
            // Extension ID를 키로 사용 (일관성 유지)
            const extensionId = chrome.runtime.id;
            const keyMaterial = await this.deriveKeyFromPassword(extensionId);
            return await this.encrypt(text, keyMaterial);
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }

    /**
     * 간단한 복호화
     */
    async simpleDecrypt(encryptedText) {
        try {
            const extensionId = chrome.runtime.id;
            const keyMaterial = await this.deriveKeyFromPassword(extensionId);
            return await this.decrypt(encryptedText, keyMaterial);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    }

    /**
     * 패스워드에서 키 유도
     */
    async deriveKeyFromPassword(password) {
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password);

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordData,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // 고정 salt (주의: 실제 프로덕션에서는 랜덤 salt를 사용하고 저장해야 함)
        const salt = encoder.encode('autopost-extension-salt');

        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: this.algorithm, length: this.keyLength },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * ArrayBuffer를 Base64로 변환
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Base64를 ArrayBuffer로 변환
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// Singleton 인스턴스
const crypto_util = new Crypto();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = crypto_util;
}
