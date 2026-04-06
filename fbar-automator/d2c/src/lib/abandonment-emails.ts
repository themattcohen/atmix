export type AbandonmentStage =
  | "SIGNED"
  | "REVIEWED"
  | "IN_PROGRESS_WITH_ACCOUNTS"
  | "IN_PROGRESS_PII_ONLY"
  | "IN_PROGRESS_EMPTY"
  | "NO_FILING";

export interface AbandonmentEmailCopy {
  subject: string;
  headline: string;
  body: string;
  cta: string;
}

export function getAbandonmentCopy(
  stage: AbandonmentStage,
  sequence: number,
  firstName: string,
  deepLink: string,
  daysUntilDeadline: number
): AbandonmentEmailCopy {
  const key = `${stage}_${sequence}` as const;

  switch (key) {
    // ---------------------------------------------------------------
    // SIGNED -- completed everything, stopped at payment
    // ---------------------------------------------------------------
    case "SIGNED_1":
      return {
        subject: "Your FBAR is signed -- just needs payment to file",
        headline: "Your filing is ready to transmit",
        body: `<p>Hi ${firstName},</p>
<p>You signed your FBAR but it looks like the payment didn't go through. Sometimes cards timeout or browsers hiccup -- it happens.</p>
<p>Your signed filing is saved and ready. Nothing was lost.</p>
<p>-- Matt</p>`,
        cta: "Complete Payment -- $59",
      };

    case "SIGNED_2":
      return {
        subject: "Your signed FBAR is waiting",
        headline: "Your filing is one step from FinCEN",
        body: `<p>Hi ${firstName},</p>
<p>Your FBAR is signed and reviewed. The only remaining step is the $59 payment, and we transmit it to FinCEN.</p>
<p>FBAR Direct is a registered BSA E-Filer (TCC: PBSA8180). We file directly through the same system CPAs and tax attorneys use.</p>
<p>If something felt off or you have a question, just reply to this email. I read every one.</p>
<p>-- Matt, FBAR Direct</p>`,
        cta: "Finish Filing",
      };

    case "SIGNED_3":
      return {
        subject: `${firstName}, your FBAR deadline is April 15`,
        headline: `${daysUntilDeadline} days to file your FBAR`,
        body: `<p>Hi ${firstName},</p>
<p>The FBAR filing deadline is April 15. The penalty for not filing is $10,000 per unreported account -- and there is no automatic extension like there is for tax returns.</p>
<p>Your FBAR is signed and reviewed. You are literally one click away from being done.</p>
<p>-- Matt</p>`,
        cta: "Pay $59 and File",
      };

    case "SIGNED_4":
      return {
        subject: "Last note about your FBAR filing",
        headline: "I will not keep emailing",
        body: `<p>Hi ${firstName},</p>
<p>This is my last email about your FBAR filing. You signed it, it's reviewed, and it's ready to transmit to FinCEN.</p>
<p>If you want to finish, the link below takes you straight to payment. If you filed through someone else or decided not to file, you can <a href="${deepLink}">log in and delete your filing</a>.</p>
<p>Either way, I will not send more emails about this.</p>
<p>-- Matt</p>`,
        cta: "Transmit My FBAR",
      };

    // ---------------------------------------------------------------
    // REVIEWED -- hesitating at signature step
    // ---------------------------------------------------------------
    case "REVIEWED_1":
      return {
        subject: "Your FBAR is reviewed -- ready when you are",
        headline: "Your filing is ready to sign",
        body: `<p>Hi ${firstName},</p>
<p>Your FBAR has been reviewed and everything looks good. The next step is an electronic signature -- the same method CPAs and tax attorneys use when filing on behalf of clients.</p>
<p>After signing, you pay $59 and we transmit it to FinCEN. The whole thing takes about 2 minutes from here.</p>
<p>-- Matt</p>`,
        cta: "Review and Sign",
      };

    case "REVIEWED_2":
      return {
        subject: "Quick note on FBAR e-signatures",
        headline: "How the signature step works",
        body: `<p>Hi ${firstName},</p>
<p>A few people have asked about the signature step, so I wanted to explain what's happening.</p>
<p>When you sign, you're authorizing FBAR Direct (TCC: PBSA8180) to file your FBAR with FinCEN on your behalf. This is the standard Form 114a authorization -- the same form every CPA and tax attorney uses.</p>
<p>Your signature is encrypted and stored securely. You can download a copy of the signed form from your account at any time.</p>
<p>Just reply if you have questions.</p>
<p>-- Matt, FBAR Direct</p>`,
        cta: "Sign Your FBAR",
      };

    case "REVIEWED_3":
      return {
        subject: `${firstName}, your reviewed FBAR needs a signature before April 15`,
        headline: `${daysUntilDeadline} days until the filing deadline`,
        body: `<p>Hi ${firstName},</p>
<p>The FBAR deadline is April 15. The penalty for not filing starts at $10,000 per unreported account.</p>
<p>Your filing is reviewed and ready -- it just needs your signature. After signing, you pay $59 and we file it. We do not store your SSN after the filing is transmitted.</p>
<p>-- Matt</p>`,
        cta: "Sign and File",
      };

    case "REVIEWED_4":
      return {
        subject: "Last reminder: your FBAR is ready to file",
        headline: "Your filing is waiting for a signature",
        body: `<p>Hi ${firstName},</p>
<p>This is my last note. Your FBAR is reviewed and ready to sign.</p>
<p>For context, CPAs charge $200-500 for the same FBAR filing we do for $59. We file through the same BSA E-Filing system they use.</p>
<p>If you have questions or something is holding you back, just reply to this email.</p>
<p>-- Matt</p>`,
        cta: "Sign and File for $59",
      };

    // ---------------------------------------------------------------
    // IN_PROGRESS_WITH_ACCOUNTS -- entered accounts, didn't review
    // ---------------------------------------------------------------
    case "IN_PROGRESS_WITH_ACCOUNTS_1":
      return {
        subject: "Your FBAR accounts are saved -- ready to review",
        headline: "Your accounts are saved",
        body: `<p>Hi ${firstName},</p>
<p>Your foreign account information is saved in your FBAR filing. The next step is reviewing everything to make sure it looks right -- takes about 2 minutes.</p>
<p>After that, you sign, pay $59, and we file it with FinCEN.</p>
<p>-- Matt</p>`,
        cta: "Review Your Filing",
      };

    case "IN_PROGRESS_WITH_ACCOUNTS_2":
      return {
        subject: "2 minutes to finish your FBAR",
        headline: "You have already done the hard part",
        body: `<p>Hi ${firstName},</p>
<p>You have already entered your account information -- that's the most time-consuming part of an FBAR filing.</p>
<p>What's left: review your accounts, sign, and pay. Nothing is submitted to FinCEN until you explicitly say so.</p>
<p>-- Matt</p>`,
        cta: "Review My Accounts",
      };

    case "IN_PROGRESS_WITH_ACCOUNTS_3":
      return {
        subject: `Your FBAR is due April 15 -- you're almost there`,
        headline: `${daysUntilDeadline} days until the FBAR deadline`,
        body: `<p>Hi ${firstName},</p>
<p>The FBAR filing deadline is April 15. Unlike tax returns, there is no automatic extension for FBAR.</p>
<p>Here is where you stand:</p>
<ul>
<li>Account information: entered</li>
<li>Review: not started (about 2 minutes)</li>
<li>Signature: pending</li>
<li>Payment: $59</li>
</ul>
<p>-- Matt</p>`,
        cta: "Finish My Filing",
      };

    case "IN_PROGRESS_WITH_ACCOUNTS_4":
      return {
        subject: "Your FBAR accounts are saved -- filing deadline approaching",
        headline: "80% of the work is done",
        body: `<p>Hi ${firstName},</p>
<p>Your foreign account information is saved and about 80% of the work is done. The remaining steps are review, sign, and pay.</p>
<p>The penalty for not filing an FBAR is $10,000 per unreported account. The deadline is April 15.</p>
<p>-- Matt</p>`,
        cta: "Complete My FBAR",
      };

    // ---------------------------------------------------------------
    // IN_PROGRESS_PII_ONLY -- entered personal info, no accounts
    // ---------------------------------------------------------------
    case "IN_PROGRESS_PII_ONLY_1":
      return {
        subject: "What you'll need to finish your FBAR",
        headline: "What you need for each account",
        body: `<p>Hi ${firstName},</p>
<p>To finish your FBAR, you will need the following for each foreign account:</p>
<ul>
<li>Name of the financial institution</li>
<li>Account number</li>
<li>Country where the account is held</li>
<li>Maximum account balance during 2025</li>
</ul>
<p>Most people finish in 5-10 minutes. You can save your progress and come back at any time.</p>
<p>-- Matt</p>`,
        cta: "Add My Accounts",
      };

    case "IN_PROGRESS_PII_ONLY_2":
      return {
        subject: "FBAR tip: maximum balance doesn't need to be exact",
        headline: "You do not need exact balances",
        body: `<p>Hi ${firstName},</p>
<p>One thing that slows people down: the maximum account balance. You do not need an exact number. FinCEN accepts reasonable estimates.</p>
<p>If your account peaked around $15,000, reporting $15,000 is fine. You do not need to find the exact statement with the highest balance.</p>
<p>-- Matt</p>`,
        cta: "Continue My Filing",
      };

    case "IN_PROGRESS_PII_ONLY_3":
      return {
        subject: `FBAR deadline: April 15 (no extensions)`,
        headline: `${daysUntilDeadline} days until the deadline`,
        body: `<p>Hi ${firstName},</p>
<p>The FBAR filing deadline is April 15. There is no automatic extension like there is for tax returns. The penalty for not filing is $10,000 per unreported account.</p>
<p>Here is what is left:</p>
<ul>
<li>Add your foreign accounts (5-10 minutes)</li>
<li>Review your filing (2 minutes)</li>
<li>Sign and pay ($59)</li>
</ul>
<p>-- Matt</p>`,
        cta: "Add Accounts and File",
      };

    case "IN_PROGRESS_PII_ONLY_4":
      return {
        subject: "Your FBAR filing is incomplete",
        headline: "Need a hand?",
        body: `<p>Hi ${firstName},</p>
<p>Your FBAR filing has your personal information but no foreign accounts yet. If you are stuck or have questions about what to report, reply to this email and I will walk you through it.</p>
<p>-- Matt</p>`,
        cta: "Finish My FBAR",
      };

    // ---------------------------------------------------------------
    // IN_PROGRESS_EMPTY -- created filing, no personal info
    // ---------------------------------------------------------------
    case "IN_PROGRESS_EMPTY_1":
      return {
        subject: "Your FBAR filing is ready to start",
        headline: "Start with your personal information",
        body: `<p>Hi ${firstName},</p>
<p>You created an FBAR filing but haven't started filling it in yet. The first step is entering your personal information -- takes about 2 minutes.</p>
<p>After that, you add your foreign accounts, review, sign, and pay $59. The whole process takes about 10 minutes.</p>
<p>-- Matt</p>`,
        cta: "Start My Filing",
      };

    case "IN_PROGRESS_EMPTY_2":
      return {
        subject: "Why we ask for your SSN on FBAR filings",
        headline: "Your data security",
        body: `<p>Hi ${firstName},</p>
<p>FinCEN requires your Social Security Number on every FBAR filing. I know that gives people pause, so here is how we handle it:</p>
<ul>
<li>Your SSN is encrypted in transit and at rest</li>
<li>We do not retain your SSN after filing -- it is purged once FinCEN accepts your submission</li>
<li>FBAR Direct is a registered BSA E-Filer (TCC: PBSA8180)</li>
<li>We file through the same BSA E-Filing system that CPAs and tax attorneys use</li>
</ul>
<p>Our business model is the $59 filing fee. We do not sell data, run ads, or do anything else with your information.</p>
<p>-- Matt, FBAR Direct</p>`,
        cta: "Continue Filing",
      };

    case "IN_PROGRESS_EMPTY_3":
      return {
        subject: "FBAR is due April 15 -- $10,000 penalty for non-filing",
        headline: `${daysUntilDeadline} days to file`,
        body: `<p>Hi ${firstName},</p>
<p>If your foreign financial accounts totaled more than $10,000 at any point during 2025, you are required to file an FBAR by April 15. The penalty for not filing starts at $10,000 per unreported account.</p>
<p>The whole process takes about 10 minutes and costs $59. We handle the FinCEN submission for you.</p>
<p>-- Matt</p>`,
        cta: "File My FBAR -- $59",
      };

    case "IN_PROGRESS_EMPTY_4":
      return {
        subject: "Your FBAR filing is still open",
        headline: "Your filing is still here",
        body: `<p>Hi ${firstName},</p>
<p>You have an open FBAR filing on FBAR Direct. If you have filed through someone else, you can log in and delete it.</p>
<p>If you still need to file, your filing is saved and ready whenever you are.</p>
<p>-- Matt</p>`,
        cta: "Complete My Filing",
      };

    // ---------------------------------------------------------------
    // NO_FILING -- account created, never started a filing
    // ---------------------------------------------------------------
    case "NO_FILING_1":
      return {
        subject: "Do you need to file an FBAR?",
        headline: "Do you need to file?",
        body: `<p>Hi ${firstName},</p>
<p>You created an FBAR Direct account but haven't started a filing yet.</p>
<p>Here is the rule: if your foreign financial accounts totaled more than $10,000 at any point during 2025, you are required to file an FBAR (FinCEN Form 114) by April 15, 2026.</p>
<p>This is separate from your tax return. It is filed directly with FinCEN, not the IRS.</p>
<p>The process takes about 10 minutes and costs $59.</p>
<p>-- Matt</p>`,
        cta: "Start My FBAR",
      };

    case "NO_FILING_2":
      return {
        subject: "3 things people get wrong about FBAR",
        headline: "Common FBAR misconceptions",
        body: `<p>Hi ${firstName},</p>
<p>Three things that trip people up about FBAR:</p>
<ol>
<li><strong>It is separate from your tax return.</strong> Filing your taxes does not cover FBAR. It is a separate filing with FinCEN.</li>
<li><strong>The $10,000 threshold is aggregate.</strong> If you have three accounts with $4,000 each, you need to file -- the total exceeds $10,000.</li>
<li><strong>There is no automatic extension.</strong> Unlike tax returns, FBAR does not automatically extend to October. The deadline is April 15.</li>
</ol>
<p>-- Matt</p>`,
        cta: "Start Filing",
      };

    case "NO_FILING_3":
      return {
        subject: "FBAR penalties start at $10,000 per account",
        headline: "The penalties are real",
        body: `<p>Hi ${firstName},</p>
<p>The penalty for not filing an FBAR is $10,000 per unreported account for non-willful violations. For willful violations, penalties go up to $100,000 or 50% of the account balance, whichever is greater.</p>
<p>I am not trying to scare you -- these are published FinCEN guidelines. If you have foreign accounts that totaled over $10,000 in 2025, you should file.</p>
<p>The filing takes about 10 minutes and costs $59.</p>
<p>-- Matt</p>`,
        cta: "File My FBAR",
      };

    case "NO_FILING_4":
      return {
        subject: "Your FBAR Direct account",
        headline: "Just checking in",
        body: `<p>Hi ${firstName},</p>
<p>You have an FBAR Direct account but have not started a filing. If you do not need to file, no worries -- we will send one reminder next January when the new filing year opens.</p>
<p>If you do need to file, the deadline is April 15.</p>
<p>-- Matt</p>`,
        cta: "Start My FBAR",
      };

    default:
      throw new Error(`Unknown abandonment email variant: stage=${stage}, sequence=${sequence}`);
  }
}
