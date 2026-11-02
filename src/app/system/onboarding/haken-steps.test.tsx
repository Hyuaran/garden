import {it,expect} from "vitest";
import {render,screen} from "@testing-library/react";
import {emptyInput,onboardingSteps} from "./_lib/onboarding";
import OnboardingReview from "./_components/OnboardingReview";
import {missingOnboardingItems} from "./_lib/onboarding-admin";
it("派遣は3画面、通常は11画面で確認も表示範囲に限定",()=>{
 expect(onboardingSteps("派遣")).toEqual([0,1,10]);expect(onboardingSteps("正社員")).toHaveLength(11);
 render(<OnboardingReview values={emptyInput()} visibleSteps={onboardingSteps("派遣")}/>);
 expect(screen.getAllByRole("heading")).toHaveLength(2);expect(screen.queryByText("ご家族")).toBeNull();
 expect(missingOnboardingItems(emptyInput(),"派遣")).not.toContain("秘密保持の確認");
});
