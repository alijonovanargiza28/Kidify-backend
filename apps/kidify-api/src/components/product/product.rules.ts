import { Product } from "./product";
export function ageRange(v: {
  ageMinMonths?: number;
  ageMaxMonths?: number;
  size?: string;
}) {
  if (v.ageMinMonths != null && v.ageMaxMonths != null)
    return [v.ageMinMonths, v.ageMaxMonths];
  const m =
    /^(?=.*(?:[-–]|[a-zA-Z]))(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(M|MO|MONTHS?|Y|YEARS?)?$/i.exec(
      (v.size || "").trim(),
    );
  if (!m) return undefined;
  const scale = /^Y/i.test(m[3]) ? 12 : 1;
  return [Number(m[1]) * scale, Number(m[2] ?? m[1]) * scale];
}
export function activeSale(
  p: Pick<Product, "productDiscount" | "saleStart" | "saleEnd">,
  now = Date.now(),
) {
  return (
    (p.productDiscount || 0) > 0 &&
    (!p.saleStart || +new Date(p.saleStart) <= now) &&
    (!p.saleEnd || +new Date(p.saleEnd) > now)
  );
}
export const saleExpression = (now = new Date()) => ({
  $and: [
    { $gt: [{ $ifNull: ["$productDiscount", 0] }, 0] },
    {
      $or: [
        { $eq: [{ $ifNull: ["$saleStart", null] }, null] },
        { $lte: ["$saleStart", now] },
      ],
    },
    {
      $or: [
        { $eq: [{ $ifNull: ["$saleEnd", null] }, null] },
        { $gt: ["$saleEnd", now] },
      ],
    },
  ],
});
export const priceExpression = () => ({
  $multiply: [
    "$productPrice",
    {
      $divide: [
        {
          $subtract: [
            100,
            {
              $cond: [
                saleExpression(),
                { $ifNull: ["$productDiscount", 0] },
                0,
              ],
            },
          ],
        },
        100,
      ],
    },
  ],
});
export const variantAgeProjection = {
  $map: {
    input: "$productVariants",
    as: "v",
    in: {
      $let: {
        vars: {
          m: {
            $regexFind: {
              input: { $ifNull: ["$$v.size", ""] },
              regex:
                "^(?=.*(?:[-–]|[a-zA-Z]))(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?\\s*(M|MO|MONTHS?|Y|YEARS?)?$",
              options: "i",
            },
          },
        },
        in: {
          $mergeObjects: [
            "$$v",
            {
              ageMinMonths: {
                $ifNull: [
                  "$$v.ageMinMonths",
                  {
                    $cond: [
                      "$$m",
                      {
                        $multiply: [
                          {
                            $convert: {
                              input: { $arrayElemAt: ["$$m.captures", 0] },
                              to: "int",
                              onError: null,
                              onNull: null,
                            },
                          },
                          {
                            $cond: [
                              {
                                $in: [
                                  {
                                    $toUpper: {
                                      $arrayElemAt: ["$$m.captures", 2],
                                    },
                                  },
                                  ["Y", "YEAR", "YEARS"],
                                ],
                              },
                              12,
                              1,
                            ],
                          },
                        ],
                      },
                      null,
                    ],
                  },
                ],
              },
              ageMaxMonths: {
                $ifNull: [
                  "$$v.ageMaxMonths",
                  {
                    $cond: [
                      "$$m",
                      {
                        $multiply: [
                          {
                            $convert: {
                              input: {
                                $ifNull: [
                                  { $arrayElemAt: ["$$m.captures", 1] },
                                  { $arrayElemAt: ["$$m.captures", 0] },
                                ],
                              },
                              to: "int",
                              onError: null,
                              onNull: null,
                            },
                          },
                          {
                            $cond: [
                              {
                                $in: [
                                  {
                                    $toUpper: {
                                      $arrayElemAt: ["$$m.captures", 2],
                                    },
                                  },
                                  ["Y", "YEAR", "YEARS"],
                                ],
                              },
                              12,
                              1,
                            ],
                          },
                        ],
                      },
                      null,
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    },
  },
};
