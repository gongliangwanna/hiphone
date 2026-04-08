/**
 * Dynamic Island — S1 only renders static idle capsule.
 * Three states (idle/minimal/expanded) will be added in S3.
 */
export function DynamicIsland() {
  return (
    <div
      data-testid="dynamic-island"
      className="bg-black"
      style={{
        width: 126,
        height: 37,
        borderRadius: 20,
      }}
    />
  );
}
