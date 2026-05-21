import { describe, it, expect } from 'vitest'
import { isPrime, nextPrime } from './primeUtils'

describe('isPrime', () => {
  it('returns false for n < 2', () => {
    expect(isPrime(-1)).toBe(false)
    expect(isPrime(0)).toBe(false)
    expect(isPrime(1)).toBe(false)
  })

  it('returns true for 2', () => {
    expect(isPrime(2)).toBe(true)
  })

  it('returns false for even numbers > 2', () => {
    expect(isPrime(4)).toBe(false)
    expect(isPrime(100)).toBe(false)
  })

  it('returns true for small primes', () => {
    [2, 3, 5, 7, 11, 13, 17, 19, 23].forEach(p => {
      expect(isPrime(p)).toBe(true)
    })
  })

  it('returns false for composites', () => {
    [4, 6, 8, 9, 15, 25, 49, 77].forEach(n => {
      expect(isPrime(n)).toBe(false)
    })
  })

  it('handles larger primes', () => {
    expect(isPrime(97)).toBe(true)
    expect(isPrime(101)).toBe(true)
    expect(isPrime(99)).toBe(false)  // 9 × 11
  })
})

describe('nextPrime', () => {
  it('returns 3 for nextPrime(2)', () => {
    expect(nextPrime(2)).toBe(3)
  })

  it('returns the next prime after a prime', () => {
    expect(nextPrime(3)).toBe(5)
    expect(nextPrime(5)).toBe(7)
    expect(nextPrime(13)).toBe(17)
  })

  it('returns the next prime after a composite', () => {
    expect(nextPrime(10)).toBe(11)
    expect(nextPrime(14)).toBe(17)
  })
})
