using UnityEngine;

/// <summary>
/// Moves the player's 4x4 forward at a fixed speed and lets the player
/// steer left/right via touch (finger horizontal position on screen) or
/// keyboard arrow keys (editor testing).
///
/// The vehicle never stops — it automatically drives forward for the
/// full 60-second game session.
/// </summary>
[RequireComponent(typeof(Rigidbody))]
public class PlayerVehicle : MonoBehaviour
{
    [Header("Speed")]
    [Tooltip("Forward speed in m/s. ~13.4 m/s ≈ 30 mph.")]
    public float forwardSpeed = 13.4f;

    [Header("Steering")]
    [Tooltip("Maximum rotation angle applied per second when fully steering.")]
    public float maxSteerDegreesPerSec = 45f;
    [Tooltip("How quickly steering snaps to the input direction.")]
    public float steerSmoothing = 8f;

    [Header("Camera Shake on Impact")]
    public Transform driverCamera;
    public float shakeAmount = 0.08f;
    public float shakeDuration = 0.25f;

    Rigidbody rb;
    float currentSteer;     // -1 to +1, smoothed
    float targetSteer;
    bool inputEnabled;

    // Camera shake state
    float shakeTimer;
    Vector3 cameraLocalOrigin;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        rb.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
        if (driverCamera) cameraLocalOrigin = driverCamera.localPosition;
    }

    void OnEnable()
    {
        GameManager.Instance.OnGameStarted += Enable;
        GameManager.Instance.OnGameOver += Disable;
        GameManager.Instance.OnZombieHit += OnHit;
    }

    void OnDisable()
    {
        if (GameManager.Instance == null) return;
        GameManager.Instance.OnGameStarted -= Enable;
        GameManager.Instance.OnGameOver -= Disable;
        GameManager.Instance.OnZombieHit -= OnHit;
    }

    void Enable() => inputEnabled = true;
    void Disable() => inputEnabled = false;
    void OnHit(int _, Vector3 __) => shakeTimer = shakeDuration;

    void Update()
    {
        ReadInput();
        AnimateCameraShake();
    }

    void FixedUpdate()
    {
        if (!GameManager.Instance.IsGameActive()) return;

        // Always move forward
        Vector3 newPos = rb.position + transform.forward * forwardSpeed * Time.fixedDeltaTime;
        rb.MovePosition(newPos);

        // Apply smoothed steering as a rotation
        currentSteer = Mathf.Lerp(currentSteer, targetSteer, steerSmoothing * Time.fixedDeltaTime);
        float yawDelta = currentSteer * maxSteerDegreesPerSec * Time.fixedDeltaTime;
        rb.MoveRotation(rb.rotation * Quaternion.Euler(0f, yawDelta, 0f));
    }

    void ReadInput()
    {
        if (!inputEnabled) { targetSteer = 0f; return; }

        // Touch: use normalised horizontal position (-1 left edge, +1 right edge)
        if (Input.touchCount > 0)
        {
            float norm = (Input.GetTouch(0).position.x / Screen.width) * 2f - 1f;
            targetSteer = norm;
        }
        else
        {
            // Keyboard fallback for Unity editor testing
            targetSteer = Input.GetAxis("Horizontal");
        }
    }

    void AnimateCameraShake()
    {
        if (driverCamera == null || shakeTimer <= 0f) return;

        shakeTimer -= Time.deltaTime;
        if (shakeTimer <= 0f)
        {
            driverCamera.localPosition = cameraLocalOrigin;
            return;
        }
        driverCamera.localPosition = cameraLocalOrigin + Random.insideUnitSphere * shakeAmount;
    }
}
