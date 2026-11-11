/**
 * Styles for OPTIONAL elements that the CMS can add but the original design did not contain
 * (featured clients on core service cards, footer contact & social links).
 *
 * Every selector targets a class that does not exist in the original markup, so with the
 * default content these rules match nothing and the page is pixel-identical to the original.
 * Values reuse the original design tokens (colors, radii, font sizes of .a-card / footer).
 */
export const EXTENSION_STYLES = `
.c-card .ur-clients{width:100%;margin-top:auto;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);text-align:center}
.c-card .ur-clients + .arrow{display:none}
.c-card .plat + .ur-clients{margin-top:0}
.c-card .ur-clients small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.c-card .ur-logos{margin-top:16px}
.c-card .ur-row{display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:22px;height:40px}
.c-card .ur-logos img{display:block;flex:0 1 auto;min-width:0;width:auto;max-width:30%;height:calc(var(--h) * .8px);object-fit:contain}
.c-card .ur-logos span{display:block;margin-top:14px;font-size:12.5px;color:rgba(255,255,255,.7);white-space:nowrap}
footer .big + .foot-line{margin-top:22px}
footer .foot-meta{margin-top:36px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px 40px;flex-wrap:wrap;font-size:15px;line-height:1.55;color:#cfe0ff}
footer .foot-contact{display:flex;flex-direction:column;gap:4px}
footer .foot-contact a:hover,footer .foot-social a:hover{color:#fff}
footer .foot-social{list-style:none;display:flex;flex-wrap:wrap;gap:10px}
footer .foot-social a{display:inline-flex;padding:7px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);font-weight:500;font-size:13.5px;transition:background .2s}
footer .foot-social a:hover{background:rgba(255,255,255,.1)}
footer .foot-meta + .bot{margin-top:32px}
@media (max-width:1100px){
  .c-card .ur-row{gap:16px;height:36px}
  .c-card .ur-logos img{height:calc(var(--h) * .7px)}
  footer .foot-meta{flex-direction:column;align-items:center;text-align:center}
  footer .foot-contact{align-items:center}
  footer .foot-social{justify-content:center}
}
`;
