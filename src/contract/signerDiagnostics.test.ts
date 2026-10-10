import { getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import type { Offer } from '../api/types'
import { buildSignerDiagnostics } from './hooks'

const vaultAddress = getAddress('0x5323fe5a5cd7eccc0ef96761c313e6fab4c324cd')
const userAddress = getAddress('0x89fa517528ad7aa188fcb7cee43a7c5b642a8327')
const signer = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')

const baseFields = [
  { name: 'positionSeed', type: 'bytes16' },
  { name: 'user', type: 'address' },
  { name: 'marketId', type: 'bytes32' },
  { name: 'tokenId', type: 'uint256' },
  { name: 'collateralUsdcUnits', type: 'uint256' },
  { name: 'leverageBps', type: 'uint32' },
  { name: 'notionalUsdcUnits', type: 'uint256' },
  { name: 'originationFeeBps', type: 'uint16' },
  { name: 'lifetimeFeeAprBps', type: 'uint16' },
  { name: 'liquidationFeeBps', type: 'uint16' },
  { name: 'venueFeeUsdcUnits', type: 'uint256' },
] as const

function v2Offer(overrides: Partial<Offer> = {}): Offer {
  return {
    evmChainId: '137',
    polygonVaultContractAddress: vaultAddress,
    positionSeedHex: '0x0123456789abcdef0123456789abcdef',
    polymarketMarketId: '0x1111111111111111111111111111111111111111111111111111111111111100',
    polymarketTokenId: '12345',
    collateralUsdcUnits: '2000000',
    leverageBps: 20000,
    notionalUsdcUnits: '4000000',
    originationFeeBps: 100,
    lifetimeFeeAprBps: 2000,
    liquidationFeeBps: 250,
    expectedOpenTradingFeeUsdcUnits: '10000',
    signatureExpiry: '1700000000',
    riskMode: 'adaptive',
    marginUsdcUnits: '0',
    polymarketProtocolVersion: 2,
    ...overrides,
  } as Offer
}

function signedMessage(offer: Offer) {
  return {
    positionSeed: offer.positionSeedHex as `0x${string}`,
    user: userAddress,
    marketId: offer.polymarketMarketId as `0x${string}`,
    tokenId: BigInt(offer.polymarketTokenId),
    collateralUsdcUnits: BigInt(offer.collateralUsdcUnits),
    leverageBps: offer.leverageBps,
    notionalUsdcUnits: BigInt(offer.notionalUsdcUnits),
    originationFeeBps: offer.originationFeeBps,
    lifetimeFeeAprBps: offer.lifetimeFeeAprBps,
    liquidationFeeBps: offer.liquidationFeeBps,
    venueFeeUsdcUnits: BigInt(offer.expectedOpenTradingFeeUsdcUnits),
  }
}

const domain = { name: 'LeveragedPredictionVaultV1', version: '1', chainId: 137, verifyingContract: vaultAddress }

describe('buildSignerDiagnostics', () => {
  it('names the with-version type when the API signed a protocol version 2 adaptive quote', async () => {
    const offer = v2Offer()
    const contractSignature = await signer.signTypedData({
      domain,
      types: {
        CreatePositionWithVersion: [
          ...baseFields,
          { name: 'protocolVersion', type: 'uint8' },
          { name: 'signatureExpiry', type: 'uint256' },
        ],
      },
      primaryType: 'CreatePositionWithVersion',
      message: { ...signedMessage(offer), protocolVersion: 2, signatureExpiry: BigInt(offer.signatureExpiry) },
    })

    const diagnostics = await buildSignerDiagnostics({ ...offer, contractSignature }, userAddress, signer.address)

    expect(diagnostics.matches).toBe('CreatePositionWithVersion (protocol version 2)')
    expect(diagnostics.quotePolymarketProtocolVersion).toBe(2)
  })

  it('names the with-margin-and-version type when the API signed a protocol version 2 committed quote', async () => {
    const offer = v2Offer({ riskMode: 'committed', marginUsdcUnits: '670000' })
    const contractSignature = await signer.signTypedData({
      domain,
      types: {
        CreatePositionWithMarginAndVersion: [
          ...baseFields,
          { name: 'marginUsdcUnits', type: 'uint256' },
          { name: 'protocolVersion', type: 'uint8' },
          { name: 'signatureExpiry', type: 'uint256' },
        ],
      },
      primaryType: 'CreatePositionWithMarginAndVersion',
      message: {
        ...signedMessage(offer),
        marginUsdcUnits: 670000n,
        protocolVersion: 2,
        signatureExpiry: BigInt(offer.signatureExpiry),
      },
    })

    const diagnostics = await buildSignerDiagnostics({ ...offer, contractSignature }, userAddress, signer.address)

    expect(diagnostics.matches).toBe('CreatePositionWithMarginAndVersion (protocol version 2)')
  })

  it('reports no match when the signature covers none of the four create types', async () => {
    const offer = v2Offer()
    const contractSignature = await signer.signMessage({ message: 'not a create payload' })

    const diagnostics = await buildSignerDiagnostics({ ...offer, contractSignature }, userAddress, signer.address)

    expect(diagnostics.matches).toBe('none — a field value differs')
  })
})
