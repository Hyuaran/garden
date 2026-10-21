import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { fiscalYearLabel, pastFiscalYears } from "@/lib/bud/mf/transactions";
export default function PeriodSelect({value,onChange,fiscalStart,years}: {value:string;onChange:(value:string)=>void;fiscalStart?:string|null;years:number[]}) {
  const options = [{value:"current",label:"今月"},{value:"last",label:"先月"},{value:"year",label:fiscalYearLabel(fiscalStart)},...pastFiscalYears(years,fiscalStart).map(year => ({value:`fy:${year}`,label:`${year}年度`}))];
  for (const selected of value.split(",")) if (selected.startsWith("fy:") && !options.some(o => o.value === selected)) options.push({value:selected,label:`${selected.slice(3)}年度`});
  return <BoxSelect label="期間" value={value.split(",")} options={options} onChange={values => onChange(values.join(","))} />;
}
