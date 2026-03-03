export const FAQ_ITEMS = [
  {
    question: "Do you actually file my FBAR, or just prepare the form?",
    answer: "We file it. FBAR Direct is a FinCEN-registered BSA E-Filing institution. We generate the required XML, submit your FBAR through the official BSA E-Filing system, and provide you with a BSA tracking ID as proof of filing. Some other services only prepare the form and leave you to navigate the government filing portal yourself — we handle the entire process from start to finish.",
  },
  {
    question: "What is an FBAR?",
    answer: "The Report of Foreign Bank and Financial Accounts (FBAR), or FinCEN Form 114, is a report required by the Bank Secrecy Act. It must be filed by United States persons who have a financial interest in or signature authority over foreign financial accounts if the aggregate value of the foreign financial accounts exceeds $10,000 at any time during the calendar year.",
  },
  {
    question: "When is the FBAR deadline?",
    answer: "The FBAR must be filed electronically with FinCEN by April 15 of each year. However, FinCEN grants an automatic extension to October 15 each year. You do not need to request this extension; it is automatic.",
  },
  {
    question: "Is FBAR Direct a government agency?",
    answer: "No. FBAR Direct is a private tax technology company and a FinCEN-registered BSA E-Filing institution. We are authorized to transmit FinCEN Form 114 on behalf of filers through the BSA E-Filing System. We are not the Department of the Treasury or FinCEN.",
  },
  {
    question: "How is my data protected?",
    answer: "All sensitive data is protected with AES-256-GCM encryption at rest and TLS encryption in transit. Your data is submitted directly to FinCEN's secure BSA E-Filing system. We do not share your personal or financial data with any third parties other than FinCEN.",
  },
  {
    question: "Can I file for previous years?",
    answer: "Yes. If you are filing late for previous years, you can select the specific calendar year you are filing for within our system. The system will prompt you to provide a reason for late filing, which is required by FinCEN.",
  },
  {
    question: "What happens if my filing is rejected?",
    answer: "In the rare event that FinCEN rejects a filing (usually due to formatting issues with specific foreign addresses), we will notify you immediately with the specific error code. You can correct the information and resubmit through our platform at no additional cost.",
  },
  {
    question: "Do you offer a money-back guarantee?",
    answer: "Yes. If we are unable to file your FBAR for any reason, you will receive a full refund. If you have not yet submitted your filing, you may request a refund within 30 days of payment.",
  },
  // --- Additional FAQ entries ---
  {
    question: "What is the $10,000 filing threshold?",
    answer: "You must file an FBAR if the aggregate maximum value of all your foreign financial accounts exceeded $10,000 at any time during the calendar year. This is the combined total across all accounts — not per account. For example, if you had three accounts worth $4,000 each at the same time, the aggregate value of $12,000 exceeds the threshold and triggers the filing requirement. Per BSA regulations, you must report all foreign accounts, even those that individually held less than $10,000.",
  },
  {
    question: "Who is required to file an FBAR?",
    answer: "Per FinCEN guidance, a 'United States person' must file an FBAR. This includes U.S. citizens (even those living abroad), U.S. residents (green card holders), resident aliens meeting the substantial presence test, and entities formed under U.S. law (trusts, estates, corporations, partnerships). If you are a U.S. citizen living overseas with foreign bank accounts exceeding the $10,000 aggregate threshold, you are still required to file.",
  },
  {
    question: "What types of accounts must be reported on the FBAR?",
    answer: "Per BSA regulations, reportable foreign financial accounts include bank accounts (checking, savings, time deposits), securities accounts (brokerage accounts), mutual funds and other pooled investment funds, insurance policies with a cash surrender value (such as whole life policies), pension accounts and retirement funds, and any other account maintained at a foreign financial institution. Note that cryptocurrency held on a foreign exchange may also be reportable — FinCEN has indicated that virtual currency held in offshore accounts may be subject to FBAR reporting requirements.",
  },
  {
    question: "What are the penalties for not filing an FBAR?",
    answer: "FBAR penalties are significant. For non-willful violations, the penalty can be up to $10,000 per violation (adjusted annually for inflation — currently up to $16,117 per account per year). For willful violations, the penalty is the greater of $100,000 (inflation-adjusted, currently up to $161,175) or 50% of the account balance at the time of the violation, per account per year. Criminal penalties for willful violations can include fines up to $250,000 and imprisonment up to five years. These penalties underscore the importance of timely and accurate filing.",
  },
  {
    question: "What is the difference between FBAR and FATCA (Form 8938)?",
    answer: "The FBAR (FinCEN Form 114) and FATCA (IRS Form 8938, Statement of Specified Foreign Financial Assets) are separate requirements with different rules. The FBAR is filed with FinCEN and has a $10,000 aggregate threshold. Form 8938 is filed with your tax return to the IRS and has higher thresholds ($50,000 on the last day of the year or $75,000 at any time for domestic filers; $200,000/$300,000 for those living abroad). If you meet the thresholds for both, you must file both forms — they do not replace each other. FBAR Direct handles FBAR filing only; for Form 8938, consult your tax preparer.",
  },
  {
    question: "Can I file an FBAR for a joint account?",
    answer: "Yes. If you and your spouse jointly own a foreign financial account, each of you must file a separate FBAR unless one spouse qualifies for the spousal filing exception. Under this exception, the non-filing spouse can be included on the other spouse's FBAR if (1) all accounts are jointly owned, (2) the filing spouse reports all jointly owned accounts on a timely filed FBAR, and (3) both spouses sign FinCEN Form 114a (Record of Authorization to Electronically File FBARs). Our system supports adding joint account holders to your filing.",
  },
  {
    question: "Do I need to report accounts where I have signature authority but no financial interest?",
    answer: "Yes. Per BSA regulations, you must file an FBAR if you have signature authority or other authority over a foreign financial account, even if you have no financial interest in it. This commonly applies to corporate officers, employees, or agents who can control the disposition of assets in a foreign account. The account must still be reported even if the account owner is already filing their own FBAR.",
  },
  {
    question: "Can I amend or correct a previously filed FBAR?",
    answer: "Yes. If you need to correct information on a previously filed FBAR, you can file an amended report. When filing an amendment through FBAR Direct, you will need to select the 'Amend a prior report' option and provide the BSA tracking ID from the original filing. There is no penalty for filing an amended FBAR to correct inadvertent errors, and there is no deadline for amendments.",
  },
  {
    question: "How does FBAR Direct work?",
    answer: "FBAR Direct is a step-by-step process: (1) Create your account and verify your email. (2) Start a new filing by selecting the calendar year. (3) Enter your personal information (name, address, SSN/ITIN). (4) Add your foreign financial accounts — either manually or by uploading bank statements for AI-powered extraction (Premium tier). (5) Review all information for accuracy. (6) Pay securely via Stripe. (7) We generate the FinCEN-compliant XML, submit it through the official BSA E-Filing system, and provide you with a BSA tracking ID as confirmation. The entire process typically takes 10-15 minutes.",
  },
  {
    question: "What are your pricing tiers?",
    answer: "We offer two tiers. Basic ($59): You manually enter your foreign account details (institution name, account number, account type, maximum value, and country). This is ideal if you have a small number of accounts and your records are well organized. Premium ($79): Includes AI-powered statement extraction. Upload your foreign bank statements (PDF or image), and our system automatically extracts account details using AI. You review and confirm the extracted data before submission. Both tiers include full FBAR filing through the BSA E-Filing system and a BSA tracking ID.",
  },
  {
    question: "How is my data encrypted?",
    answer: "We use AES-256-GCM encryption for all sensitive data at rest, which is the same encryption standard used by the U.S. government for classified information. All data transmitted between your browser and our servers is protected with TLS (Transport Layer Security) encryption. Uploaded bank statements are stored in encrypted object storage and are automatically deleted after your filing is processed. We never store your data longer than necessary to complete the filing.",
  },
  {
    question: "What happens after my FBAR is filed?",
    answer: "After you complete payment, we generate the FinCEN-compliant XML batch file and submit it through the official BSA E-Filing system. You will receive a BSA tracking ID, which serves as proof of filing. FinCEN typically processes submissions within 1-2 business days. Once accepted, the filing status on your dashboard will update to 'Accepted.' If there are any issues, we will notify you with the specific error details so you can make corrections.",
  },
  {
    question: "What is your refund policy?",
    answer: "We offer a straightforward refund policy. If we are unable to file your FBAR for any reason — whether due to a system issue or a FinCEN rejection we cannot resolve — you will receive a full refund, no questions asked. If you change your mind before your filing has been submitted to FinCEN, you may request a refund within 30 days of payment. Once a filing has been submitted and accepted by FinCEN, refunds are not available because the service has been fully rendered. Contact support@fbardirect.com for any refund requests.",
  },
  {
    question: "What if I am filing late or have delinquent FBARs?",
    answer: "If you have not filed FBARs for prior years, you should file them as soon as possible. FinCEN allows late filings and provides a specific process for delinquent FBARs. If you are not under IRS examination and have not been contacted by the IRS regarding the delinquent FBARs, you may be eligible for the IRS Delinquent FBAR Submission Procedures, which generally do not impose penalties if the IRS determines the failure was non-willful. FBAR Direct supports filing for prior calendar years. For complex situations involving multiple years of unfiled FBARs, we recommend consulting a tax attorney or CPA before filing.",
  },
  {
    question: "How long should I keep records of my FBAR filing?",
    answer: "Per BSA regulations, you must keep records of your foreign financial accounts and FBAR filings for five years from the due date of the FBAR. Records should include the name and address of each foreign financial institution, account numbers, the type of account, and the maximum account value during the reporting year. FBAR Direct retains your filing records on your dashboard, but we recommend keeping your own copies of all supporting documents (bank statements, account summaries) for the full five-year retention period.",
  },
  {
    question: "Does the FBAR threshold apply to cryptocurrency?",
    answer: "FinCEN has stated that it intends to propose regulations that would include virtual currency as a reportable account type on the FBAR. As of the 2025 filing year, FinCEN has not yet finalized these regulations. However, if you hold cryptocurrency on a foreign exchange (for example, an exchange headquartered outside the United States), many tax professionals recommend reporting it on the FBAR as a best practice. The account value should be converted to U.S. dollars using the exchange rate on the date of maximum value. Consult a tax advisor for guidance specific to your situation.",
  },
  {
    question: "What if I have accounts in multiple countries?",
    answer: "You report all foreign financial accounts on a single FBAR, regardless of how many countries are involved. Each account is listed individually with its country, institution name, account number, account type, and maximum value. The $10,000 aggregate threshold applies to the total across all accounts in all countries combined. FBAR Direct supports accounts in any country and any currency — our system automatically handles the currency conversion using Treasury Department exchange rates for the applicable calendar year.",
  },
  {
    question: "Do I need to report a foreign account that was closed during the year?",
    answer: "Yes. If a foreign financial account was open at any point during the calendar year and contributed to exceeding the $10,000 aggregate threshold, it must be reported on the FBAR. This applies even if the account was opened and closed within the same year, or if the balance was zero at the time of closure. Report the maximum value the account held at any time during the year, per FinCEN instructions.",
  },
  // --- AEO-targeted high-volume queries ---
  {
    question: "Can I file my FBAR myself without a CPA?",
    answer: "Yes. You are not required to hire a CPA or tax professional to file your FBAR. FinCEN allows individuals to file FinCEN Form 114 directly through the BSA E-Filing system, or through a registered filing service like FBAR Direct. FBAR Direct costs $59-$79 compared to $200-$500+ for a CPA. A CPA is recommended only for complex situations such as trusts, entities, delinquent filings, or if you are under IRS examination.",
  },
  {
    question: "Do I need to report a foreign pension on my FBAR?",
    answer: "Yes, in most cases. Foreign pension accounts and retirement funds are considered foreign financial accounts under BSA regulations and must be reported on the FBAR if you have a financial interest in or signature authority over the account and the aggregate value of all your foreign accounts exceeds $10,000. This includes employer-sponsored pension plans, government pension schemes, and private retirement accounts held at foreign financial institutions. Some notable examples include UK pensions (SIPP, workplace pensions), Australian superannuation funds, and Canadian RRSPs.",
  },
  {
    question: "What happens if I file my FBAR late?",
    answer: "If you file late but have not been contacted by the IRS, you may be eligible for the IRS Delinquent FBAR Submission Procedures, which generally do not impose penalties if the IRS determines the failure was non-willful. However, if you fail to file and the IRS discovers the omission, penalties can be severe: up to $16,117 per account per year for non-willful violations, and up to the greater of $161,175 or 50% of the account balance for willful violations. The safest course is to file as soon as possible. FBAR Direct supports filing for prior calendar years.",
  },
  {
    question: "Is FBAR the same as FATCA?",
    answer: "No. FBAR (FinCEN Form 114) and FATCA (IRS Form 8938) are separate requirements filed with different agencies. The FBAR is filed with FinCEN and has a $10,000 aggregate account threshold. Form 8938 is filed with the IRS as part of your tax return and has higher thresholds ($50,000-$200,000 depending on filing status and residency). If you meet both thresholds, you must file both forms — one does not replace the other. FBAR Direct handles FBAR filing only.",
  },
  {
    question: "How long does it take to file an FBAR?",
    answer: "With FBAR Direct, most people complete their filing in under 10 minutes. The process involves entering your personal information, adding your foreign account details (or uploading bank statements for AI extraction with the Premium tier), reviewing the information, and paying. We then generate the FinCEN-compliant XML and submit it through the BSA E-Filing system. You receive a BSA tracking ID as proof of filing, typically within minutes of submission.",
  },
  {
    question: "What is the FBAR penalty for not filing?",
    answer: "FBAR penalties are among the harshest in tax law. For non-willful violations, the penalty is up to $16,117 per account per year (adjusted annually for inflation). For willful violations, the penalty is the greater of $161,175 or 50% of the account balance at the time of the violation, per account per year. Criminal penalties for willful violations can include fines up to $250,000 and imprisonment up to 5 years. These penalties apply per account, per year — meaning multiple unfiled years with multiple accounts can result in penalties exceeding the total account balances.",
  },
  {
    question: "Do US expats need to file an FBAR?",
    answer: "Yes. U.S. citizens living abroad are still required to file an FBAR if the aggregate value of their foreign financial accounts exceeds $10,000 at any time during the calendar year. Living overseas does not exempt you from FBAR filing requirements. In fact, expats often have more foreign accounts (local bank accounts, pension funds, investment accounts) that trigger the filing requirement. The FBAR deadline is April 15 with an automatic extension to October 15. FBAR Direct supports filings for expats in any country.",
  },
  // --- App-specific FAQ entries ---
  {
    question: "How do I create an account on FBAR Direct?",
    answer: "Visit fbardirect.com and click 'Get Started' or 'Sign Up.' Enter your email address and create a password. You will receive a verification email — click the link in that email to activate your account. Check your spam or junk folder if you do not see it within a few minutes. The verification link expires after 24 hours. Once verified, you can log in and start a new FBAR filing immediately.",
  },
  {
    question: "How do I reset my password?",
    answer: "On the login page, click the 'Forgot password' link. Enter your email address and we will send you a password reset link. The link expires after 1 hour. Click it to set a new password. If you do not receive the email, check your spam or junk folder. There is no separate settings page for changing your password — always use the forgot-password flow.",
  },
  {
    question: "What do the filing statuses on my dashboard mean?",
    answer: "Your dashboard shows the current status of each filing: 'Not Started' or 'In Progress' means you are still completing the form. 'Ready to Sign' means your information is entered and ready for your digital signature. 'Signed' means you have signed and are ready to pay. 'Processing' or 'Submitting' means payment was received and we are submitting to FinCEN. 'Submitted' means it has been sent to FinCEN and is awaiting their response (typically 1-2 business days). 'Filed (Accepted)' means FinCEN accepted it — your BSA tracking ID is your proof of filing. 'Needs Attention (Rejected)' means FinCEN rejected it — we will review and resubmit at no extra charge.",
  },
  {
    question: "Can I file for multiple years at once?",
    answer: "Yes. You can start a new filing for each calendar year you need to file (we support years 2010 through the current year). Each filing is completed and paid for separately. If you filed for a previous year through FBAR Direct, you can import your account details from that filing to save time. You cannot create two original filings for the same calendar year, but you can amend a previously accepted filing.",
  },
  {
    question: "What file formats can I upload for the Premium tier?",
    answer: "The Premium tier ($79) supports uploading bank statements in the following formats: PDF, JPEG, PNG, GIF, WebP, CSV, and XLSX. The maximum file size is 50 MB per file. Our AI system will extract account details (institution name, account number, account type, and maximum value) automatically. You can review and edit any extracted field before saving, or delete the extraction and enter details manually.",
  },
  {
    question: "Is my Social Security Number safe on FBAR Direct?",
    answer: "Yes. Your SSN or ITIN is encrypted with AES-256-GCM, the same encryption standard used by the U.S. government for classified information. Only the last 4 digits are stored for display on your dashboard — the full number is encrypted at rest and only decrypted when generating your FinCEN filing. All data in transit is protected with TLS encryption. We never share your personal data with anyone other than FinCEN for the purpose of filing your FBAR.",
  },
  {
    question: "What should I do if the AI extraction got something wrong?",
    answer: "You can edit any field that the AI extracted before saving the account. If the extraction is significantly off, you can delete the extracted account entirely and enter the details manually instead. The AI shows confidence indicators for each field to help you identify values that may need review. Premium tier users always have the option to enter accounts manually as well.",
  },
  {
    question: "How do I contact FBAR Direct support?",
    answer: "You can reach us by email at support@fbardirect.com, by phone at (888) 863-5518 (voicemail — we return calls within one business day), or by using the contact form on our website. You can also ask questions using the chat assistant on our website for immediate answers about FBAR filing and how our service works. We typically respond to all inquiries within one business day.",
  },
];
