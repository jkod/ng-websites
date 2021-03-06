import { Result, RuleBuilder, RulesEngine } from 'core';
import { Page } from 'material-cms-view';

export class PageApprovalRules {
  private readonly rulesEngine: RulesEngine;

  constructor() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effectiveFromMsg = 'Please enter a valid date today or in the future.';
    const contentMsg = 'Please enter something.';

    const rules = RuleBuilder.for<Page>()
      .property(x => x.effectiveFrom).date(effectiveFromMsg).required(effectiveFromMsg).minDate(today, effectiveFromMsg)
      .property(x => x.content).required(contentMsg)
      .build();

    this.rulesEngine = RulesEngine.create(rules);
  }

  check(model: Page): Result {
    return this.rulesEngine.check(model);
  }
}
