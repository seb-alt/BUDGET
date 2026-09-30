import { describe, expect, it } from 'vitest'
import { LEGACY_LOAN_ID, extractLoansInBackupData, loanFromLegacy, settingsWithoutLoan } from './extractLoans'

const NOW = '2026-10-01T09:00:00.000Z'

describe('loanFromLegacy', () => {
  it('convertit un prêt rempli', () => {
    const loan = loanFromLegacy(
      { initialAmount: 3800000, monthlyPayment: 35000, remainingCapital: 2900000, lastUpdated: '2026-09-15' },
      NOW,
    )
    expect(loan).toMatchObject({
      id: LEGACY_LOAN_ID,
      name: 'Prêt étudiant',
      initialAmount: 3800000,
      monthlyPayment: 35000,
      remainingCapital: 2900000,
      lastUpdated: '2026-09-15',
    })
  })

  /*
   * Le cas qui compte : depuis que le remplissage initial est neutre, tout le
   * monde part avec un prêt à zéro. Le convertir créerait, chez chacun, une
   * ligne vide surgie de nulle part qu'il faudrait supprimer à la main.
   */
  it('ne convertit pas un prêt entièrement à zéro', () => {
    expect(
      loanFromLegacy(
        { initialAmount: 0, monthlyPayment: 0, remainingCapital: 0, lastUpdated: '2026-09-30' },
        NOW,
      ),
    ).toBeUndefined()
  })

  it('convertit dès qu’un seul champ est renseigné', () => {
    expect(
      loanFromLegacy(
        { initialAmount: 0, monthlyPayment: 0, remainingCapital: 150000, lastUpdated: '2026-09-30' },
        NOW,
      ),
    ).toBeDefined()
  })

  it('accepte des réglages sans prêt du tout', () => {
    expect(loanFromLegacy(undefined, NOW)).toBeUndefined()
  })
})

describe('settingsWithoutLoan', () => {
  it('retire le champ hérité et garde le reste', () => {
    const out = settingsWithoutLoan({ id: 1, referenceIncome: 200000, studentLoan: { initialAmount: 1 } })
    expect(out).toEqual({ id: 1, referenceIncome: 200000 })
  })

  it('ne se plaint pas si le champ est déjà absent', () => {
    expect(settingsWithoutLoan({ id: 1 })).toEqual({ id: 1 })
  })
})

describe('extractLoansInBackupData', () => {
  const legacy = () => ({
    settings: [
      {
        id: 1,
        referenceIncome: 200000,
        studentLoan: {
          initialAmount: 3800000, monthlyPayment: 35000,
          remainingCapital: 2900000, lastUpdated: '2026-09-15',
        },
      },
    ],
    transactions: [],
  })

  it('sort le prêt des réglages et le met dans sa table', () => {
    const out = extractLoansInBackupData(legacy(), NOW)
    expect(out.loans).toHaveLength(1)
    expect((out.loans[0] as { name: string }).name).toBe('Prêt étudiant')
    expect(out.settings[0]).not.toHaveProperty('studentLoan')
    expect((out.settings[0] as { referenceIncome: number }).referenceIncome).toBe(200000)
  })

  it('ne touche pas à une sauvegarde qui porte déjà des prêts', () => {
    const already = { ...legacy(), loans: [{ id: 'loan-a', name: 'Auto' }] }
    const out = extractLoansInBackupData(already, NOW)
    expect(out.loans).toEqual([{ id: 'loan-a', name: 'Auto' }])
  })

  it('appliqué deux fois, ne duplique rien', () => {
    const once = extractLoansInBackupData(legacy(), NOW)
    expect(extractLoansInBackupData(once, NOW).loans).toHaveLength(1)
  })

  it('accepte une sauvegarde sans réglages', () => {
    expect(extractLoansInBackupData({ transactions: [] }, NOW).loans).toEqual([])
  })
})
