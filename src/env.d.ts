declare module "*.yaml?raw" {
  const contents: string;
  export default contents;
}

declare module "*.csv?raw" {
  const contents: string;
  export default contents;
}
