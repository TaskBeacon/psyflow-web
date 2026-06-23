export class PythonRandom {
  private mt = new Array<number>(624).fill(0);
  private index = 624;

  constructor(seed: number) {
    this.seed(seed);
  }

  private seed(seed: number): void {
    this.mt[0] = 19650218;
    for (let index = 1; index < 624; index += 1) {
      const previous = this.mt[index - 1] ^ (this.mt[index - 1] >>> 30);
      this.mt[index] = (Math.imul(1812433253, previous) + index) >>> 0;
    }

    const key = [Math.abs(Math.trunc(seed)) >>> 0];
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k -= 1) {
      const previous = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(previous, 1664525)) + key[j] + j) >>> 0;
      i += 1;
      j += 1;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
      if (j >= key.length) {
        j = 0;
      }
    }
    for (let k = 623; k > 0; k -= 1) {
      const previous = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(previous, 1566083941)) - i) >>> 0;
      i += 1;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
    }
    this.mt[0] = 0x80000000;
    this.index = 624;
  }

  private nextUint32(): number {
    if (this.index >= 624) {
      this.twist();
    }
    let value = this.mt[this.index];
    this.index += 1;
    value ^= value >>> 11;
    value ^= (value << 7) & 0x9d2c5680;
    value ^= (value << 15) & 0xefc60000;
    value ^= value >>> 18;
    return value >>> 0;
  }

  private twist(): void {
    for (let index = 0; index < 624; index += 1) {
      const y = (this.mt[index] & 0x80000000) + (this.mt[(index + 1) % 624] & 0x7fffffff);
      let value = this.mt[(index + 397) % 624] ^ (y >>> 1);
      if (y % 2 !== 0) {
        value ^= 0x9908b0df;
      }
      this.mt[index] = value >>> 0;
    }
    this.index = 0;
  }

  random(): number {
    const a = this.nextUint32() >>> 5;
    const b = this.nextUint32() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  randBelow(maxExclusive: number): number {
    const max = Math.max(1, Math.floor(maxExclusive));
    const bitLength = max.toString(2).length;
    let value = this.nextUint32() >>> (32 - bitLength);
    while (value >= max) {
      value = this.nextUint32() >>> (32 - bitLength);
    }
    return value;
  }

  randint(minInclusive: number, maxInclusive: number): number {
    const min = Math.ceil(minInclusive);
    const max = Math.floor(maxInclusive);
    return min + this.randBelow(max - min + 1);
  }

  shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = this.randBelow(index + 1);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }
}
