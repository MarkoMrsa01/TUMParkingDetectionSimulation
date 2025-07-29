import * as math from 'mathjs';

export class KalmanFilter {
    constructor(initialPos = [0, 0], initialRotation = 0, initialScale = { x: 1, y: 1, z: 1 }) {
        this.x = math.matrix([initialPos[0], initialPos[1], 0, 0]); // [x, y, vx, vy]
        this.P = math.identity(4).map(() => 1000); // Initial uncertainty
        this.rotation = initialRotation;
        this.scale = initialScale;
        this.F = math.matrix([
            [1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ]); // State transition matrix
        this.H = math.matrix([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ]); // Measurement matrix
        this.R = math.matrix([
            [10, 0],
            [0, 10]
        ]); // Measurement noise
        this.Q = math.matrix([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ]); // Process noise
    }

    predict() {
        this.x = math.multiply(this.F, this.x);
        this.P = math.add(
            math.multiply(math.multiply(this.F, this.P), math.transpose(this.F)),
            this.Q
        );
    }

    update(measurement) {
        const y = math.subtract(measurement, math.multiply(this.H, this.x));
        const S = math.add(
            math.multiply(math.multiply(this.H, this.P), math.transpose(this.H)),
            this.R
        );
        const K = math.multiply(
            math.multiply(this.P, math.transpose(this.H)),
            math.inv(S)
        );

        this.x = math.add(this.x, math.multiply(K, y));
        const I = math.identity(4);
        this.P = math.multiply(
            math.subtract(I, math.multiply(K, this.H)),
            this.P
        );
    }

    setRotation(rotation) {
        this.rotation = rotation;
    }

    setScale(scale) {
        this.scale = scale;
    }

    getPosition() {
        return { x: this.x.get([0]), y: this.x.get([1]) };
    }
}
