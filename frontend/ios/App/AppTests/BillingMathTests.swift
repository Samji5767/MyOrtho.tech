import Testing
import Foundation
@testable import App

// Tests for plannedInstallments() — the installment-schedule generator.
// Key property: sum of all installments must exactly equal totalToSchedule
// (within the 0.01 minor-unit resolution of the scheduler).

@Suite("Billing math — plannedInstallments")
struct BillingMathTests {

    // MARK: — Even splits

    @Test("AED even split: 900 / 3 = three × 300.00")
    func aedEvenSplit() {
        let schedule = plannedInstallments(
            totalToSchedule: 900, downPayment: 0,
            installmentCount: 3, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 3)
        #expect(schedule.allSatisfy { $0.amount == 300 })
        #expect(schedule.map(\.amount).reduce(0, +) == 900)
    }

    // MARK: — Non-even splits (remainder absorbed by last installment)

    @Test("AED non-even: 1000 / 3 → 333.33 + 333.33 + 333.34")
    func aedNonEvenRemainderOnLast() {
        let schedule = plannedInstallments(
            totalToSchedule: 1000, downPayment: 0,
            installmentCount: 3, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 3)
        #expect(schedule[0].amount == Decimal(string: "333.33")!)
        #expect(schedule[1].amount == Decimal(string: "333.33")!)
        #expect(schedule[2].amount == Decimal(string: "333.34")!)
        #expect(schedule.map(\.amount).reduce(0, +) == 1000)
    }

    // MARK: — Down payment

    @Test("Down payment + 2 installments sum to total")
    func downPaymentSumEqualsTotal() {
        let schedule = plannedInstallments(
            totalToSchedule: 1200, downPayment: 200,
            installmentCount: 2, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 3)  // 1 down payment + 2 regular
        #expect(schedule[0].amount == 200)
        #expect(schedule[1].amount == 500)
        #expect(schedule[2].amount == 500)
        #expect(schedule.map(\.amount).reduce(0, +) == 1200)
    }

    // MARK: — BHD/KWD 3-decimal precision

    @Test("BHD sub-0.01 amount: scheduler rounds to nearest 0.01")
    func bhdThreeDecimalRounding() {
        // BHD has 3 decimal places; the scheduler works at 0.01 (2-decimal) resolution.
        // 99.999 × 100 = 9999.9 → rounds to 10000 minor → schedule produces 100.00.
        let schedule = plannedInstallments(
            totalToSchedule: Decimal(string: "99.999")!, downPayment: 0,
            installmentCount: 1, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 1)
        #expect(schedule[0].amount == 100)  // rounded up by plain rounding
    }

    @Test("BHD clean 3-decimal: 99.990 rounds to 99.99 (already expressible in 0.01)")
    func bhdCleanAmount() {
        let schedule = plannedInstallments(
            totalToSchedule: Decimal(string: "99.990")!, downPayment: 0,
            installmentCount: 1, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 1)
        #expect(schedule[0].amount == Decimal(string: "99.99")!)
        #expect(schedule.map(\.amount).reduce(0, +) == Decimal(string: "99.99")!)
    }

    // MARK: — Sum equality guarantee

    @Test("Single installment equals total exactly")
    func singleInstallmentEqualsTotal() {
        let schedule = plannedInstallments(
            totalToSchedule: 9999, downPayment: 0,
            installmentCount: 1, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 1)
        #expect(schedule.map(\.amount).reduce(0, +) == 9999)
    }

    @Test("12-month plan sum equals total (with down payment)")
    func twelveMonthPlanSum() {
        let schedule = plannedInstallments(
            totalToSchedule: 12000, downPayment: 1000,
            installmentCount: 12, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 13)  // 1 down payment + 12 installments
        #expect(schedule.map(\.amount).reduce(0, +) == 12000)
    }

    @Test("Prime total into prime count: sum guarantee holds")
    func primeTotalPrimeCountSumGuarantee() {
        // 9997 / 7 is not evenly divisible — hardest case for rounding
        let schedule = plannedInstallments(
            totalToSchedule: 9997, downPayment: 0,
            installmentCount: 7, startDate: .now, frequency: .monthly
        )
        #expect(schedule.count == 7)
        #expect(schedule.map(\.amount).reduce(0, +) == 9997)
    }

    // MARK: — Edge cases

    @Test("Zero total produces empty schedule")
    func zeroTotalEmptySchedule() {
        let schedule = plannedInstallments(
            totalToSchedule: 0, downPayment: 0,
            installmentCount: 3, startDate: .now, frequency: .monthly
        )
        #expect(schedule.isEmpty)
    }

    @Test("Down payment equal to total: no regular installments")
    func downPaymentEqualsTotal() {
        // All of 500 is the down payment; 0 remains for regular installments.
        let schedule = plannedInstallments(
            totalToSchedule: 500, downPayment: 500,
            installmentCount: 1, startDate: .now, frequency: .monthly
        )
        let sum = schedule.map(\.amount).reduce(0, +)
        // Down payment entry exists; any zero-amount installments are included.
        // The only guarantee is sum == totalToSchedule.
        #expect(sum == 500)
    }

    @Test("Frequency: fortnightly produces correct date spacing")
    func fortnightlyDates() {
        let start = Calendar.current.startOfDay(for: .now)
        let schedule = plannedInstallments(
            totalToSchedule: 600, downPayment: 0,
            installmentCount: 3, startDate: start, frequency: .fortnightly
        )
        #expect(schedule.count == 3)
        let diff1 = Calendar.current.dateComponents([.day], from: schedule[0].dueDate, to: schedule[1].dueDate).day ?? 0
        let diff2 = Calendar.current.dateComponents([.day], from: schedule[1].dueDate, to: schedule[2].dueDate).day ?? 0
        #expect(diff1 == 14)
        #expect(diff2 == 14)
    }
}
