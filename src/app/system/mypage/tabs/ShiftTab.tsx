import MyShift from "@/app/system/shift/MyShift";
export default function ShiftTab({ embedded = false }: { embedded?: boolean }) {
  void embedded;
  return <MyShift />;
}
