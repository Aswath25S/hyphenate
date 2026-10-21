/** Title rules for "roles to keep". Unclear titles go to an LLM check in the filter stage. */

const KEEP = [
  /\baccounts? receivable\b/i, /(?<!,\s?)\bA\/?R\b(?!\s*-\s*\d)/, /\bbilling\b/i, /\bcollections?\b/i, /\bcash appl/i, /\bcredit (analyst|manager|specialist)\b/i,
  /\baccounts? payable\b/i, /(?<!,\s?)\bA\/?P\b/, /\bprocure[- ]?to[- ]?pay\b/i, /\bP2P\b/, /\bprocurement account/i, /\bvendor management\b/i,
  /\baccountant\b/i, /\baccounting\b/i, /\bgeneral ledger\b/i, /\bGL\b/, /\brevenue (accountant|accounting|recognition)\b/i,
  /\bclose manager\b/i, /\bcontroller\b/i, /\bcomptroller\b/i,
  /\btreasury\b/i, /\bcash manag/i,
  /\bfinancial reporting\b/i, /\bSEC reporting\b/, /\bFP&A\b/, /\bFPA\b/, /\bfinancial plann/i, /\bfinance analyst\b/i, /\bfinancial analyst\b/i,
  /\bpayroll\b/i, /\btax (accountant|analyst|manager|senior|director)\b/i, /\bsenior tax\b/i,
  /\bfinance (manager|associate|specialist|operations|ops)\b/i, /\bfinance & accounting\b/i, /\bbookkeep/i,
  /\bconsolidation/i, /\btechnical accounting\b/i, /\bSOX\b/,
];

const DROP = [
  /\bintern(ship)?\b/i, /\bco-?op\b/i, /\bchief financial officer\b/i, /\bCFO\b/, /\bvice president\b/i, /\bVP\b/, /\bSVP\b/, /\bEVP\b/,
  /\bsoftware engineer/i, /\bengineer(ing)?\b/i, /\bdeveloper\b/i, /\bsales\b(?!.*(accountant|accounting|tax|operations analyst))/i,
  /\baccount (executive|manager|director|representative|strategist)\b/i, /\bcustomer success\b/i, /\bsolutions?\b/i,
  /\bmedical billing\b/i, /\bbilling (specialist|coordinator)\b.*\b(medical|patient|clinic|insurance)\b/i, /\bpatient\b/i,
  /\bproduct manager\b/i, /\bdesigner\b/i, /\brecruit/i, /\bmarketing\b/i, /\bnurse\b/i, /\bphysician\b/i,
  /\brevenue (operations|enablement|strategy|readiness|recovery|insights|systems|cycle)\b/i, /\brevops\b/i, /\bhead of revenue\b/i,
  /\bland revenue\b/i, /\bfinancial crimes?\b/i, /\bAML\b/, /\bfraud\b/i, /\bcredit (portfolio|risk|strategy|policy)\b/i,
  /\bcapital markets\b/i, /\bdata (scientist|analyst|engineer)\b/i, /\banalytics\b/i, /\bfinance (systems|technology|applications)\b/i,
  /\bsystems (analyst|manager|associate)\b/i, /\bfinancial systems\b/i, /\bproduct owner\b/i, /\bbusiness analyst\b/i,
  /\bexecutive assistant\b/i, /\bchief of staff\b/i, /\bprogram (manager|owner)\b/i, /\bclaims\b/i, /\bbilling support\b/i,
  /\bcollections (strategy|&\s*recovery)\b/i, /\b(winter|summer|fall|spring) 20\d\d\b/i, /\bportfolio analyst\b/i,
  /\bwarehouse finance\b/i, /\bquality assurance\b/i, /\bcompliance\b/i, /\barchitect\b/i, /\b(MD|DO|RN|NP|LCSW|LPC|PA-C)\b/, /\bcare coordinator\b/i, /\bimplementation\b/i, /\bhospital billing\b/i, /\bprescrib/i, /\bdirector\b.*\btransformation\b/i,
];

export type TitleVerdict = 'keep' | 'drop' | 'unclear';

export function classifyTitle(title: string): TitleVerdict {
  const t = title.replace(/\s+/g, ' ');
  if (DROP.some((r) => r.test(t))) {
    // CFO/VP titles are dropped only when they have no listed duties, which the filter checks;
    // here a VP/CFO title is marked unclear so the filter can look at the description.
    if (/\b(chief financial officer|CFO|vice president|VP|SVP|EVP)\b/i.test(t) && KEEP.some((r) => r.test(t)) && !/intern/i.test(t))
      return 'unclear';
    return 'drop';
  }
  if (KEEP.some((r) => r.test(t))) return 'keep';
  if (/\bfinance\b|\bfinancial\b|\brevenue\b|\bcash\b|\bAR\b|\bAP\b/i.test(t)) return 'unclear';
  return 'drop';
}
