using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;

/// <summary>
/// Floating "+N ☕🍰" label that rises and fades after each zombie hit.
/// Attach to a prefab that has:
///   - TextMeshProUGUI  (child)
///   - CanvasGroup      (root, for alpha fade)
/// </summary>
[RequireComponent(typeof(CanvasGroup))]
public class ScorePopup : MonoBehaviour
{
    [Header("Animation")]
    public float risePx = 120f;         // How many UI pixels it travels upward
    public float duration = 1.2f;
    public AnimationCurve scaleCurve = AnimationCurve.EaseInOut(0f, 1.2f, 1f, 0.8f);

    TextMeshProUGUI label;
    CanvasGroup canvasGroup;

    static readonly string[] Icons = { "☕", "🍰", "🎂", "🧁" };

    void Awake()
    {
        label = GetComponentInChildren<TextMeshProUGUI>();
        canvasGroup = GetComponent<CanvasGroup>();
    }

    public void Show(int points)
    {
        string icon = Icons[Random.Range(0, Icons.Length)];
        label.text = $"+{points} {icon}";
        StartCoroutine(Animate());
    }

    IEnumerator Animate()
    {
        Vector2 startPos = ((RectTransform)transform).anchoredPosition;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;

            ((RectTransform)transform).anchoredPosition =
                startPos + Vector2.up * risePx * t;

            canvasGroup.alpha = 1f - Mathf.Pow(t, 1.5f);
            transform.localScale = Vector3.one * scaleCurve.Evaluate(t);

            yield return null;
        }

        Destroy(gameObject);
    }
}
